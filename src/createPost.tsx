import { Devvit } from '@devvit/public-api';

// Adds a new menu item to the subreddit allowing to create a new event scheduler post
Devvit.addMenuItem({
  label: 'Create Community Event Scheduler',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();
    const post = await reddit.submitPost({
      title: 'Community Event Scheduler',
      subredditName: subreddit.name,
      // The preview appears while the post loads
      preview: (
        <vstack height="100%" width="100%" alignment="middle center">
          <text size="large">Loading Event Scheduler...</text>
        </vstack>
      ),
    });
    ui.showToast({ text: 'Event Scheduler created!' });
    ui.navigateTo(post);
  },
});

