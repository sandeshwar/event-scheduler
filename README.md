# Community Event Scheduler - Devvit App

A comprehensive event management tool for Reddit communities that allows moderators and users to create, manage, and participate in community events directly within Reddit.

## 🎯 Overview

The Community Event Scheduler is designed to enhance community engagement by providing a structured way to organize and participate in events. Built specifically for Reddit's Devvit platform, it integrates seamlessly with existing subreddit workflows while providing powerful event management capabilities.

## ✨ Features

### Event Management
- **Create Events**: Comprehensive event creation with title, description, date/time, location, and categories
- **Interactive Display**: Events shown with countdown timers, RSVP functionality, and status indicators
- **RSVP System**: One-click RSVP with attendance tracking and visual feedback
- **Event Categories**: Organize events by type (AMA, Watch Party, Game Night, Discussion, Other)
- **Real-time Updates**: Dynamic countdown timers and live status updates

### User Experience
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Intuitive Interface**: Clean, Reddit-themed design with easy navigation
- **Filtering Options**: Filter events by category for better organization
- **Status Tracking**: Clear indicators for upcoming, live, and ended events

### Moderation Tools
- **Creator Controls**: Event creators can delete their own events
- **Subreddit Integration**: Events are stored per-subreddit for proper isolation
- **Easy Installation**: Simple menu item for moderators to create event scheduler posts

## 🚀 Quick Start

### Prerequisites
- Reddit account with developer access
- Devvit CLI installed (`npm install -g @devvit/cli`)
- Node.js 18+ installed

### Installation
1. Clone or download the project files
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Login to Devvit: `devvit login`
5. Upload the app: `devvit upload`
6. Test in your subreddit: `devvit playtest your-test-subreddit`

### Usage
1. **For Moderators**: Use "Create Community Event Scheduler" from the subreddit menu
2. **For Users**: Click "Open Event Scheduler" on any event scheduler post
3. **Creating Events**: Use the "Create Event" tab to add new events
4. **Participating**: RSVP to events and track upcoming activities

## 🏗️ Technical Architecture

### Backend (Devvit Blocks)
- **Custom Post Type**: Renders the event scheduler interface within Reddit posts
- **Redis Storage**: Persistent storage for events, RSVPs, and user data
- **Message Handling**: Processes communication between web view and backend
- **Menu Integration**: Provides moderators with creation tools

### Frontend (Web View)
- **Event Interface**: Interactive cards with countdown timers and RSVP buttons
- **Creation Form**: Comprehensive form with validation and user feedback
- **Navigation System**: Tab-based interface for viewing and creating events
- **Responsive Design**: Mobile-optimized with touch-friendly interactions

### Data Model
```typescript
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
```

## 🛡️ Compliance & Safety

### Compliance
- ✅ Provides discrete, valuable functionality
- ✅ Clear naming and accurate descriptions
- ✅ Proper data handling and user privacy
- ✅ No collection of sensitive information
- ✅ Implements content validation and reporting mechanisms

### Safety
- Input validation prevents harmful content
- User data limited to Reddit usernames for RSVP functionality
- Proper error handling with user-friendly feedback
- Integration with Reddit's existing moderation tools

## 🔧 Development

### Project Structure
```
event-scheduler/
├── src/
│   ├── main.tsx          # Main app logic
│   ├── createPost.tsx    # Menu item creation
│   └── message.ts        # Type definitions
├── webroot/
│   ├── page.html         # Web view interface
│   ├── style.css         # Styling
│   └── script.js         # Client-side logic
├── devvit.yaml           # App configuration
└── package.json          # Dependencies
```

### Testing
- Run `devvit playtest <subreddit>` for live testing
- Monitor with `devvit logs <subreddit>`

### Building
The app uses TypeScript and is built automatically by the Devvit platform during upload.

## Future Improvements

- Show list of users who have RSVP'd to an event
- Allow users to un-rsvp from events
- Moderators should be able to update/add/delete event categories
- Add support for event reminders
- Add support for recurring events
- Support for updating event details
- Option to upload event images (banner)



## 📄 License

This project is licensed under the BSD-3-Clause License.

## 🎉 Acknowledgments

- Built with Reddit's Devvit platform
- Created to enhance community engagement and organization

---

**Ready to enhance your community's event organization? Install the Community Event Scheduler today!**

