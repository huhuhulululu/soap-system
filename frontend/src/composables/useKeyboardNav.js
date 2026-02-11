import { ref, onMounted, onUnmounted } from 'vue'

export function useKeyboardNav(files, selectFile) {
  const currentIndex = ref(-1)

  const handleKeydown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      currentIndex.value = Math.min(currentIndex.value + 1, files.value.length - 1)
      selectFile(files.value[currentIndex.value])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      currentIndex.value = Math.max(currentIndex.value - 1, 0)
      selectFile(files.value[currentIndex.value])
    } else if (e.key === 'Escape') {
      currentIndex.value = -1
      selectFile(null)
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })

  return { currentIndex }
}