import "./createPost.js";
import { Devvit, useWebView, useAsync } from "@devvit/public-api";
import type { DevvitMessage, WebViewMessage, Event } from "./message.js";

Devvit.configure({
  redditAPI: true,
  redis: true,
});

Devvit.addCustomPostType({
  name: "Event Calendar",
  description: "Schedule events for your community",
  height: "regular",
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

    // 3 upcoming events
    const { data: top3UpcomingEvents = [], loading: top3UpcomingEventsLoading } = useAsync(async () => {
      if (!events) return [];
      return events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).slice(0, 3);
    }, { depends: [events] });

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
        height="100%"
        width="100%"
        padding="medium"
        gap="medium"
        backgroundColor="neutral-background-weak"
        cornerRadius="medium"
      >
        {/* <hstack gap="medium" alignment="middle">
          <icon name="calendar" size="medium" color="neutral-content" />
          <text size="large" weight="bold">
            Community Event Scheduler
          </text>
        </hstack> */}

        <text size="large" weight="bold" alignment="center middle" style="heading">Upcoming Events</text>
        <hstack width="100%" height="2px" backgroundColor="neutral-border-weak" />
        <spacer size="small" />

        <vstack gap="medium" grow width="100%" height="100%">
         {top3UpcomingEvents && top3UpcomingEvents.length > 0 ? (
           <vstack alignment="start" gap="large" grow>
             {top3UpcomingEvents.map((event: Event, index: number) => (
               <hstack key={`${index}`} gap="medium">
                 <icon name="calendar" size="small" color="neutral-content" />
                 <text size="medium" weight="bold">
                   {event.title}
                 </text>
               </hstack>
             ))}
           </vstack>
         ) : (
           <text>No upcoming events</text>
         )}
        </vstack>

        <button
          appearance="primary"
          size="small"
          onPress={() => {
            webView.mount();
          }}
        >
          { isModerator ? "Manage Events" : "View Events" }
        </button>
      </vstack>
    );
  },
});

export default Devvit; 