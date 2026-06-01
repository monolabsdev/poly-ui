export class ObjectUrlRegistry {
  private readonly urls = new Set<string>();

  constructor(
    private readonly createUrl = (file: Blob) => URL.createObjectURL(file),
    private readonly revokeUrl = (url: string) => URL.revokeObjectURL(url),
  ) {}

  create(file: Blob) {
    const url = this.createUrl(file);
    this.urls.add(url);
    return url;
  }

  release(url?: string) {
    if (!url || !this.urls.delete(url)) return;
    this.revokeUrl(url);
  }

  clear() {
    for (const url of this.urls) this.revokeUrl(url);
    this.urls.clear();
  }
}

