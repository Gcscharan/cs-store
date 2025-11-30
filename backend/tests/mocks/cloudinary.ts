import { jest } from "@jest/globals";

// Mock Cloudinary upload response
export const mockCloudinaryUpload = {
  public_id: "test_public_id",
  secure_url: "https://res.cloudinary.com/test/image.jpg",
  format: "jpg",
  bytes: 12345,
  width: 800,
  height: 600,
  resource_type: "image",
  created_at: "2023-01-01T00:00:00.000Z",
  tags: [],
  url: "http://res.cloudinary.com/test/image.jpg",
  original_filename: "test_image",
  etag: "test_etag",
  signature: "test_signature",
  version: 1,
  version_id: "test_version_id",
  placeholder: false,
  access_mode: "public",
  overwritable: true,
  moderated: false,
  deleted: false,
  type: "upload",
  folder: "",
  metadata: {},
};

// Mock Cloudinary v2 instance
export const mockCloudinary = {
  config: jest.fn(),
  uploader: {
    upload: jest.fn().mockResolvedValue(mockCloudinaryUpload),
    upload_stream: jest.fn(),
    destroy: jest.fn().mockResolvedValue({ result: "ok" }),
    explicit: jest.fn(),
  },
  api: {
    resource: jest.fn().mockResolvedValue(mockCloudinaryUpload),
    delete_resources: jest.fn().mockResolvedValue({ deleted: [mockCloudinaryUpload.public_id] }),
  },
  search: {
    expression: jest.fn(),
    execute: jest.fn().mockResolvedValue({ resources: [mockCloudinaryUpload] }),
  },
};

// Helper functions for test setup
export function mockCloudinaryUploadResponse(overrides: any = {}) {
  const response = { ...mockCloudinaryUpload, ...overrides };
  mockCloudinary.uploader.upload.mockResolvedValueOnce(response);
  return response;
}

export function mockCloudinaryUploadError(error: any) {
  mockCloudinary.uploader.upload.mockRejectedValueOnce(error);
}

export function mockCloudinaryDestroyResponse(result: any = { result: "ok" }) {
  mockCloudinary.uploader.destroy.mockResolvedValueOnce(result);
  return result;
}

export function clearAllMocks() {
  mockCloudinary.uploader.upload.mockClear();
  mockCloudinary.uploader.destroy.mockClear();
  mockCloudinary.api.resource.mockClear();
  mockCloudinary.api.delete_resources.mockClear();
  mockCloudinary.search.expression.mockClear();
  mockCloudinary.search.execute.mockClear();
}
