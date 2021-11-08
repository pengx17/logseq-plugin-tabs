export interface ITabInfo {
  // Main attributes from page/block
  uuid?: string;
  name?: string;
  originalName?: string;
  page?: {
    id: number;
  };
  properties?: {
    emoji?: string;
  };

  // UI States:
  pinned?: boolean;
  scrollTop?: number;
}
