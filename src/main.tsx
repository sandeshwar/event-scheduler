import "./createPost.js";
import { Devvit, useWebView, useAsync } from "@devvit/public-api";
import type { DevvitMessage, WebViewMessage, Event } from "./message.js";

Devvit.configure({
  redditAPI: true,
  redis: true,
});

Devvit.addCustomPostType({
  name: "Community Event Scheduler",
  description: "Schedule events for your community",
  height: "tall",
  render: (context) => {
    // Fetch username
    const { data: username, loading: usernameLoading } = useAsync(
      async () => await context.reddit.getCurrentUsername() ?? "<anon>"
    );

    // Fetch subreddit name
    const { data: subredditName, loading: subredditLoading } = useAsync(
      async () => await context.reddit.getCurrentSubredditName() ?? "<unknown>"
    );

    // Fetch user object and check mod permissions
    const { data: isModerator, loading: modLoading } = useAsync(
      async () => {
        if (!username || !subredditName) return false;
        const user = await context.reddit.getUserByUsername(username);
        if (!user) return false;
        const permissions = await user.getModPermissionsForSubreddit(subredditName);
        return Array.isArray(permissions) && permissions.length > 0;
      },
      { depends: [username, subredditName] }
    );

    // Load events from redis
    const { data: events = [], loading: eventsLoading }: { data: Event[], loading: boolean } = useAsync(async () => {
      const redisEvents = await context.redis.get(`events_${context.postId}`);
      return redisEvents ? JSON.parse(redisEvents) : [];
    });

    const webView = useWebView<WebViewMessage, DevvitMessage>({
      url: "page.html",
      async onMessage(message, webView) {
        switch (message.type) {
          case "webViewReady":
            // Only send initial data if all required data is loaded
            if (
              usernameLoading ||
              subredditLoading ||
              modLoading ||
              eventsLoading
            ) {
              // Optionally, you could queue this or send a loading message
              return;
            }
            webView.postMessage({
              type: "initialData",
              data: {
                username: username || "<anon>",
                events,
                isModerator: isModerator || false,
              },
            });
            break;
          case "createEvent":
            const newEvent = {
              id: Date.now().toString(),
              title: message.data.title,
              description: message.data.description,
              startTime: message.data.startTime,
              endTime: message.data.endTime,
              location: message.data.location,
              category: message.data.category,
              creator: username ?? '<anon>',
              rsvps: [],
              createdAt: new Date().toISOString(),
            };
            const updatedEvents = [...events, newEvent];
            await context.redis.set(
              `events_${context.postId}`,
              JSON.stringify(updatedEvents)
            );
            webView.postMessage({
              type: "eventCreated",
              data: {
                event: newEvent,
                events: updatedEvents,
              },
            });
            break;
          case "rsvpEvent":
            const eventId = message.data.eventId;
            const updatedEventsWithRsvp = events.map((event) => {
              if (event.id === eventId) {
                // Avoid mutating the original event object
                const rsvps = Array.isArray(event.rsvps) ? [...event.rsvps] : [];
                if (!rsvps.find((rsvp) => rsvp.userId === username)) {
                  rsvps.push({
                    userId: username || '<anon>',
                    timestamp: new Date().toISOString(),
                  });
                }
                return { ...event, rsvps };
              }
              return event;
            });
            await context.redis.set(
              `events_${context.postId}`,
              JSON.stringify(updatedEventsWithRsvp)
            );
            webView.postMessage({
              type: "rsvpUpdated",
              data: {
                events: updatedEventsWithRsvp,
              },
            });
            break;
          case "deleteEvent":
            const eventToDeleteId = message.data.eventId;
            const filteredEvents = events.filter(
              (event) => event.id !== eventToDeleteId
            );
            await context.redis.set(
              `events_${context.postId}`,
              JSON.stringify(filteredEvents)
            );
            webView.postMessage({
              type: "eventDeleted",
              data: {
                events: filteredEvents,
              },
            });
            break;
          default:
            throw new Error(`Unknown message type: ${message satisfies never}`);
        }
      },
      onUnmount() {
        // context.ui.showToast("Event Scheduler closed!");
      },
    });

    // Render loading state if any data is still loading
    if (usernameLoading || subredditLoading || modLoading || eventsLoading) {
      return (
        <vstack grow padding="small">
          <text>Loading...</text>
        </vstack>
      );
    }

    // Render the custom post type
    return (
      <vstack
        grow
        padding="large"
        alignment="middle center"
        gap="large"
        backgroundColor="neutral-background-weak"
        cornerRadius="medium"
      >
        <hstack gap="medium" alignment="middle">
          <icon name="calendar" size="large" color="action-primary" />
          <text size="xlarge" weight="bold">
            Community Event Scheduler
          </text>
        </hstack>

        <vstack alignment="center" gap="small">
          {/* <text size="large" color="text-weak">
            Welcome, {username}!
          </text> */}
          <text size="medium" color="text-weak">
            There are currently {events.length} events scheduled.
          </text>
        </vstack>

        <button
          appearance="primary"
          onPress={() => {
            webView.mount();
          }}
        >
          Open Scheduler
        </button>
      </vstack>
    );
  },
});

export default Devvit;