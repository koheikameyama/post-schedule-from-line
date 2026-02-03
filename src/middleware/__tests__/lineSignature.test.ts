import { Request, Response } from "express";
import { verifyLineSignature } from "../lineSignature";
import crypto from "crypto";

describe("LINE Signature Verification", () => {
  const channelSecret = "test-channel-secret";
  const originalEnv = process.env.LINE_CHANNEL_SECRET;

  beforeAll(() => {
    process.env.LINE_CHANNEL_SECRET = channelSecret;
  });

  afterAll(() => {
    process.env.LINE_CHANNEL_SECRET = originalEnv;
  });

  it("should pass verification with valid signature", () => {
    const body = JSON.stringify({ events: [] });
    const signature = crypto
      .createHmac("sha256", channelSecret)
      .update(body)
      .digest("base64");

    const req = {
      headers: { "x-line-signature": signature },
      body: body,
      rawBody: body,
    } as any as Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any as Response;

    const next = jest.fn();

    verifyLineSignature(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should reject request with invalid signature", () => {
    const body = JSON.stringify({ events: [] });

    const req = {
      headers: { "x-line-signature": "invalid-signature" },
      body: body,
      rawBody: body,
    } as any as Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any as Response;

    const next = jest.fn();

    verifyLineSignature(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
  });

  it("should reject request without signature", () => {
    const req = {
      headers: {},
      body: JSON.stringify({ events: [] }),
    } as any as Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any as Response;

    const next = jest.fn();

    verifyLineSignature(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
