import type { Request } from "express";
import { createAIGenerateRouter } from "../ai-generate";
import { generateWithAI } from "../../services/ai-generator";
import { createMockResponse, getRouteHandler } from "./route-test-helpers";

jest.mock("../../services/ai-generator", () => ({
  generateWithAI: jest.fn(),
}));

describe("ai-generate route", () => {
  it("returns 400 when required fields are missing", async () => {
    const router = createAIGenerateRouter();
    const handler = getRouteHandler(router, "post", "/generate");
    const req = { body: { bodyPart: "LBP" } } as unknown as Request;
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "Missing required fields: bodyPart, noteType, laterality",
    });
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  it("calls AI service and returns success payload", async () => {
    const router = createAIGenerateRouter();
    const handler = getRouteHandler(router, "post", "/generate");
    const req = {
      body: { bodyPart: "LBP", noteType: "TX", laterality: "bilateral" },
    } as unknown as Request;
    const res = createMockResponse();
    (generateWithAI as any).mockResolvedValue({
      success: true,
      text: "SOAP",
    });

    await handler(req, res);

    expect(generateWithAI).toHaveBeenCalledWith(req.body);
    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({ success: true, text: "SOAP" });
  });
});
