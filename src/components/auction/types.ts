export type Lot = {
  id: string;
  name: string;
  price: number;
  order: number;
  pinned?: boolean;
};

export type Bid = {
  id: string;
  lotId: string;
  lotName: string;
  user: string;
  amount: number;
  ts: number;
};

export type HistoryEntry = {
  id: string;
  text: string;
  ts: number;
};

export type ArchivedAuction = {
  id: string;
  name: string;
  lots: Lot[];
  bids: Bid[];
  savedAt: number;
};
