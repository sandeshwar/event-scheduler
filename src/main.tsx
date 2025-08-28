import { Devvit, useWebView, useAsync, useState } from "@devvit/public-api";
import type { DevvitMessage, WebViewMessage, Event } from "./message.js";

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Helper to format date
const formatDate = (date: string) => {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  return Intl.DateTimeFormat("en-US", options).format(new Date(date));
};

Devvit.addCustomPostType({
  name: "Event Calendar",
  description: "Schedule events for your community",
  height: "tall",
  render: (context) => {
    const { postId } = context;
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fetch username
    const { data: username, loading: usernameLoading } = useAsync(async () => {
      const user = await context.reddit.getCurrentUser();
      return user?.username ?? "<anon>";
    });

    // Fetch subreddit name
    const { data: subredditName, loading: subredditLoading } = useAsync(
      async () => {
        const subreddit = await context.reddit.getCurrentSubreddit();
        return subreddit?.name ?? "<unknown>";
      }
    );

    // Fetch user object and check mod permissions
    const { data: isModerator, loading: modLoading } = useAsync(
      async () => {
        if (!username || !subredditName) return false;
        const user = await context.reddit.getUserByUsername(username);
        if (!user) return false; // Check if user is undefined
        const permissions = await user.getModPermissionsForSubreddit(
          subredditName
        );
        return Array.isArray(permissions) && permissions.length > 0;
      },
      { depends: [username, subredditName] }
    );

    // Load events from redis
    const { data: events = [], loading: eventsLoading } = useAsync(
      async () => {
        const redisEvents = await context.redis.get(`events_${postId}`);
        return redisEvents ? JSON.parse(redisEvents) : [];
      },
      { depends: [refreshTrigger] }
    );

    // Filter for live events
    const { data: liveEvents = [] } = useAsync(
      async () => {
        if (!events) return [];
        const now = new Date().getTime();
        return events
          .filter((event: Event) => {
            const startTime = new Date(event.startTime).getTime();
            const endTime = event.endTime
              ? new Date(event.endTime).getTime()
              : Infinity;
            return startTime <= now && now < endTime;
          })
          .sort(
            (a: Event, b: Event) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );
      },
      { depends: [events] }
    );

    // Filter for upcoming events
    const { data: upcomingEvents = [] } = useAsync(
      async () => {
        if (!events) return [];
        const now = new Date().getTime();
        return events
          .filter((event: Event) => new Date(event.startTime).getTime() > now)
          .sort(
            (a: Event, b: Event) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );
      },
      { depends: [events] }
    );

    const webView = useWebView<WebViewMessage, DevvitMessage>({
      url: "page.html",
      async onMessage(message, webView) {
        switch (message.type) {
          case "webViewReady":
            if (
              usernameLoading ||
              subredditLoading ||
              modLoading ||
              eventsLoading
            )
              return;
            webView.postMessage({
              type: "initialData",
              data: { username: username!, events, isModerator: isModerator! },
            });
            break;
          case "createEvent":
            const newEvent = {
              id: Date.now().toString(),
              ...message.data,
              creator: username ?? "<anon>",
              rsvps: [],
              createdAt: new Date().toISOString(),
            };
            const updatedEvents = [...events, newEvent];
            await context.redis.set(
              `events_${postId}`,
              JSON.stringify(updatedEvents)
            );
            webView.postMessage({
              type: "eventCreated",
              data: { event: newEvent, events: updatedEvents },
            });
            setRefreshTrigger((t) => t + 1);
            break;
          case "updateEvent":
            const updatedEventsList = events.map((event: Event) => 
              event.id === message.data.eventId 
                ? { ...event, ...message.data, id: event.id, creator: event.creator, rsvps: event.rsvps, createdAt: event.createdAt }
                : event
            );
            await context.redis.set(
              `events_${postId}`,
              JSON.stringify(updatedEventsList)
            );
            webView.postMessage({
              type: "eventUpdated",
              data: { events: updatedEventsList },
            });
            setRefreshTrigger((t) => t + 1);
            break;
          case "rsvpEvent":
            const rsvpEvents = events.map((event: Event) => 
              event.id === message.data.eventId 
                ? { 
                    ...event, 
                    rsvps: event.rsvps.some((rsvp) => rsvp.userId === username) 
                      ? event.rsvps.filter((rsvp) => rsvp.userId !== username)
                      : [...event.rsvps, { userId: username ?? "<anon>", timestamp: new Date().toISOString() }] 
                  }
                : event
            );
            await context.redis.set(
              `events_${postId}`,
              JSON.stringify(rsvpEvents)
            );
            webView.postMessage({
              type: "rsvpUpdated",
              data: { events: rsvpEvents },
            });
            setRefreshTrigger((t) => t + 1);
            break;
          case "deleteEvent":
            const filteredEvents = events.filter(
              (event: Event) => event.id !== message.data.eventId
            );
            await context.redis.set(
              `events_${postId}`,
              JSON.stringify(filteredEvents)
            );
            webView.postMessage({
              type: "eventDeleted",
              data: { events: filteredEvents },
            });
            setRefreshTrigger((t) => t + 1);
            break;
        }
      },
    });

    if (usernameLoading || subredditLoading || modLoading || eventsLoading) {
      return (
        <vstack grow padding="small">
          <text color="neutral-content-weak">Loading...</text>
        </vstack>
      );
    }

    return (
      <vstack
        backgroundColor="neutral-background"
        padding="medium"
        gap="medium"
        grow
      >
        {/* Live Events Section */}
        {liveEvents.length > 0 && (
          <vstack gap="medium">
            <spacer grow />
            <text color="neutral-content-weak" size="small" weight="bold">
              LIVE NOW
            </text>
            {liveEvents.map((event: Event) => (
              <vstack
                key={event.id}
                padding="medium"
                cornerRadius="medium"
                backgroundColor="neutral-background-container"
              >
                <hstack alignment="top" gap="medium">
                  <icon
                    name="calendar"
                    size="large"
                    color="neutral-content-strong"
                  />
                  <vstack gap="medium" grow>
                    <hstack alignment="middle">
                      <text
                        color="neutral-content-strong"
                        size="large"
                        weight="bold"
                      >
                        {event.title}
                      </text>
                      <spacer grow />
                      <button appearance="destructive" size="small">
                        LIVE NOW
                      </button>
                    </hstack>
                    <hstack alignment="middle" gap="small">
                      <icon
                        name="location"
                        size="small"
                        color="neutral-content-weak"
                      />
                      <text color="neutral-content-weak" size="medium">
                        {event.location}
                      </text>
                    </hstack>
                    <hstack alignment="middle" gap="small">
                      <icon
                        name="calendar"
                        size="small"
                        color="neutral-content-weak"
                      />
                      <text color="neutral-content-weak" size="medium">
                        {formatDate(event.startTime)}
                      </text>
                    </hstack>
                  </vstack>
                </hstack>
              </vstack>
            ))}
          </vstack>
        )}

        {/* Upcoming Events Section */}
        {upcomingEvents.length > 0 && (
          <vstack gap="medium">
            <spacer grow />
            <text color="neutral-content-weak" size="small" weight="bold">
              UPCOMING
            </text>
            <hstack gap="medium">
              {upcomingEvents.slice(0, 2).map((event: Event) => (
                <vstack
                  key={event.id}
                  padding="medium"
                  cornerRadius="medium"
                  backgroundColor="neutral-background-container"
                  grow
                >
                  <hstack alignment="top" gap="medium">
                    <icon
                      name="calendar"
                      size="medium"
                      color="neutral-content-strong"
                    />
                    <vstack gap="medium" grow>
                      <text
                        color="neutral-content-strong"
                        size="medium"
                        weight="bold"
                      >
                        {event.title}
                      </text>
                      <hstack alignment="middle" gap="small">
                        <icon
                          name="location"
                          size="small"
                          color="neutral-content-weak"
                        />
                        <text color="neutral-content-weak" size="small">
                          {event.location}
                        </text>
                      </hstack>
                      <hstack alignment="middle" gap="small">
                        <icon
                          name="calendar"
                          size="small"
                          color="neutral-content-weak"
                        />
                        <text color="neutral-content-weak" size="small">
                          {formatDate(event.startTime)}
                        </text>
                      </hstack>
                    </vstack>
                  </hstack>
                </vstack>
              ))}
            </hstack>
          </vstack>
        )}

        {/* No Events State */}
        {liveEvents.length === 0 && upcomingEvents.length === 0 && (
          <vstack alignment="center" padding="large" grow>
            <text color="neutral-content-strong" size="large" weight="bold">
              No upcoming events
            </text>
            <text color="neutral-content-weak" size="medium">
              Check back later!
            </text>
          </vstack>
        )}

        <spacer grow />

        {/* Manage Events Button */}
        <button appearance="primary" onPress={() => webView.mount()}>
          {isModerator ? "Manage Events" : "View Events"}
        </button>
      </vstack>
    );
  },
});

export default Devvit;
