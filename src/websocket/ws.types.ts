export interface WsMessage<T = Record<string, unknown>> {
  type: string;
  payload: T;
  id?: string;
}

export interface BufferedWsEvent {
  id: string;
  userId: string;
  message: WsMessage;
  createdAt: string;
}
