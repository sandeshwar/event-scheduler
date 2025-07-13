/** Message from Devvit to the web view. */
export type DevvitMessage =
  | { type: 'initialData'; data: { username: string; events: Event[], isModerator: boolean } }
  | { type: 'eventCreated'; data: { event: Event; events: Event[] } }
  | { type: 'rsvpUpdated'; data: { events: Event[] } }
  | { type: 'eventDeleted'; data: { events: Event[] } };

/** Message from the web view to Devvit. */
export type WebViewMessage =
  | { type: 'webViewReady' }
  | { type: 'createEvent'; data: { title: string; description: string; startTime: string; endTime: string; location: string; category: string } }
  | { type: 'rsvpEvent'; data: { eventId: string } }
  | { type: 'deleteEvent'; data: { eventId: string } };

/**
 * Web view MessageEvent listener data type. The Devvit API wraps all messages
 * from Blocks to the web view.
 */
export type DevvitSystemMessage = {
  data: { message: DevvitMessage };
  /** Reserved type for messages sent via `context.ui.webView.postMessage`. */
  type?: 'devvit-message' | string;
};

export type Event = {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  category: string;
  creator: string;
  rsvps: RSVP[];
  createdAt: string;
}

export type RSVP = {
  userId: string;
  timestamp: string;
}

