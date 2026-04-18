import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { checkerService } from "../services/checker";
import { parseBillListHtml, detectBillFormat } from "../services/bill-list-parser";
import { matchBillToNote } from "../services/bill-matcher";

export const useFilesStore = defineStore("files", () => {
  // State
  const files = ref([]);
  const selectedFileId = ref(null);
  const isProcessing = ref(false);
  const insuranceType = ref("OPTUM");
  const treatmentTime = ref(15);

  // Bill state (仅本次会话，切换 note 会重置)
  const billFile = ref(null);
  const billData = ref(null);         // BillList
  const billError = ref("");

  // Getters
  const hasFiles = computed(() => files.value.length > 0);

  const selectedFile = computed(
    () => files.value.find((f) => f.id === selectedFileId.value) || null,
  );

  const processedFiles = computed(() =>
    files.value.filter((f) => f.status === "done"),
  );

  const pendingFiles = computed(() =>
    files.value.filter((f) => f.status === "pending"),
  );

  // Bill match result derived from current selected note + billData
  const billMatchResult = computed(() => {
    if (!billData.value || !selectedFile.value?.report?.document) return null;
    try {
      return matchBillToNote(billData.value, selectedFile.value.report.document);
    } catch (err) {
      return null;
    }
  });

  const stats = computed(() => {
    const done = processedFiles.value;
    if (done.length === 0) return null;

    const grades = { PASS: 0, WARNING: 0, FAIL: 0 };
    let totalScore = 0;
    let totalErrors = 0;

    done.forEach((f) => {
      if (f.report) {
        grades[f.report.summary.scoring.grade]++;
        totalScore += f.report.summary.scoring.totalScore;
        totalErrors += f.report.summary.errorCount.total;
      }
    });

    return {
      total: done.length,
      grades,
      avgScore: Math.round(totalScore / done.length),
      totalErrors,
    };
  });

  // Actions
  function addFiles(newFiles) {
    const formatted = newFiles.map((f) => ({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: f.name,
      file: f,
      status: "pending",
      source: "upload",
      report: null,
      error: null,
    }));
    files.value = [...files.value, ...formatted];
  }

  function selectFile(file, opts = {}) {
    const prevId = selectedFileId.value;
    selectedFileId.value = file?.id || null;
    // 切换到不同的已验证 note 时，清空 bill 避免静默错绑到另一份病历
    // 除非调用方显式 keepBill（例如 handleFiles 新增 + 选中同一次上传）
    if (!opts.keepBill && prevId && file && prevId !== file.id) {
      clearBill();
    }
  }

  function removeFile(fileId) {
    files.value = files.value.filter((f) => f.id !== fileId);
    if (selectedFileId.value === fileId) {
      selectedFileId.value = null;
      clearBill(); // 删除当前 note 清空 bill（P2 场景 (c)）
    }
  }

  function clearAll() {
    files.value = [];
    selectedFileId.value = null;
    clearBill();
  }

  async function setBillFile(file) {
    billFile.value = file;
    billError.value = "";
    billData.value = null;
    const token = file;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      if (billFile.value !== token) return;
      const fmt = detectBillFormat(buf);
      if (fmt === "xlsx-binary") {
        throw new Error("二进制 Excel 不支持，请从 iClinic 导出为 HTML 格式");
      }
      if (fmt === "unknown") {
        throw new Error("无法识别文件格式，请上传 HTML 表格导出文件");
      }
      const text = new TextDecoder("utf-8").decode(buf);
      billData.value = parseBillListHtml(text);
    } catch (err) {
      if (billFile.value !== token) return;
      billError.value = err instanceof Error ? err.message : String(err);
    }
  }

  function clearBill() {
    billFile.value = null;
    billData.value = null;
    billError.value = "";
  }

  async function processAllFiles() {
    if (isProcessing.value) return;
    isProcessing.value = true;

    const processedResults = [];

    for (const file of files.value) {
      if (file.status !== "pending") continue;

      file.status = "processing";

      try {
        const report = await checkerService.validateFile(file.file, {
          insuranceType: insuranceType.value,
          treatmentTime: treatmentTime.value,
        });
        file.report = report;
        file.status = "done";

        // Collect successful results for history
        processedResults.push({
          fileName: file.name,
          report,
        });
      } catch (err) {
        file.status = "error";
        file.error = err.message || String(err);
      }
    }

    isProcessing.value = false;

    // Auto-select first completed file
    if (!selectedFileId.value && processedFiles.value.length > 0) {
      selectedFileId.value = processedFiles.value[0].id;
    }

    // Save to history if we have successful results
    if (processedResults.length > 0) {
      try {
        const { useHistory } = await import("../composables/useHistory");
        const history = useHistory();

        processedResults.forEach((result) => {
          // Strip heavy fields to avoid localStorage quota overflow
          const {
            document: _doc,
            visitTexts: _vt,
            raw: _raw,
            ...lightweight
          } = result.report;
          history.saveResult(result.fileName, lightweight);
        });
      } catch {
        // History save is best-effort; silently ignore failures
      }
    }
  }

  function loadFromHistory(fileName, report) {
    const id = "history_" + Date.now().toString(36);
    const entry = {
      id,
      name: fileName,
      file: null,
      status: "done",
      source: "history",
      report,
      error: null,
    };
    files.value = [entry];
    selectedFileId.value = id;
    clearBill(); // history 加载清空 bill（P2 场景 (b)）
  }

  return {
    // State
    files,
    selectedFileId,
    isProcessing,
    insuranceType,
    treatmentTime,
    billFile,
    billData,
    billError,
    // Getters
    hasFiles,
    selectedFile,
    processedFiles,
    pendingFiles,
    stats,
    billMatchResult,
    // Actions
    addFiles,
    selectFile,
    removeFile,
    clearAll,
    processAllFiles,
    loadFromHistory,
    setBillFile,
    clearBill,
  };
});
