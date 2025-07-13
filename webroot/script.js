/** @typedef {import('../src/message.ts').DevvitSystemMessage} DevvitSystemMessage */
/** @typedef {import('../src/message.ts').WebViewMessage} WebViewMessage */
/** @typedef {import('../src/message.ts').Event} Event */

class EventSchedulerApp {
  constructor() {
    this.events = [];
    this.username = 'Guest';
    this.currentFilter = '';
    this.isModerator = false; 
    
    // Get references to HTML elements
    this.usernameLabel = document.querySelector('#username');
    this.viewEventsBtn = document.querySelector('#btn-view-events');
    this.createEventBtn = document.querySelector('#btn-create-event');
    this.viewEventsSection = document.querySelector('#view-events');
    this.createEventSection = document.querySelector('#create-event');
    this.eventsList = document.querySelector('#events-list');
    this.eventForm = document.querySelector('#event-form');
    this.categoryFilter = document.querySelector('#category-filter');
    this.cancelBtn = document.querySelector('#btn-cancel');

    // Set up event listeners
    this.setupEventListeners();

    // Listen for messages from Devvit
    addEventListener('message', this.onMessage);

    // Notify Devvit that the web view is ready
    addEventListener('load', () => {
      postWebViewMessage({ type: 'webViewReady' });
    });
  }

  setupEventListeners() {
    // Navigation
    this.viewEventsBtn.addEventListener('click', () => this.showSection('view-events'));
    this.createEventBtn.addEventListener('click', () => this.showSection('create-event'));
    
    // Event form
    document.querySelector('#create-event .btn-primary').addEventListener('click', (e) => this.handleCreateEvent(e));
    this.cancelBtn.addEventListener('click', () => this.showSection('view-events'));
    
    // Filter
    this.categoryFilter.addEventListener('change', (e) => {
      this.currentFilter = e.target.value;
      this.renderEvents();
    });
  }

  onMessage = (ev) => {
    if (ev.data.type !== 'devvit-message') return;
    const { message } = ev.data.data;

    switch (message.type) {
      case 'initialData':
        this.username = message.data.username;
        this.events = message.data.events || [];
        this.isModerator = message.data.isModerator; 
        // this.usernameLabel.innerText = this.username; // Not required
        this.renderEvents();
        this.updateCreateEventButtonVisibility(); 
        break;
      case 'eventCreated':
        this.events = message.data.events;
        this.renderEvents();
        this.showSection('view-events');
        this.eventForm.reset();
        break;
      case 'rsvpUpdated':
        this.events = message.data.events;
        this.renderEvents();
        break;
      case 'eventDeleted':
        this.events = message.data.events;
        this.renderEvents();
        break;
    }
  };

  showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
      section.classList.remove('active');
    });
    
    // Remove active class from nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Show selected section
    document.querySelector(`#${sectionId}`).classList.add('active');
    
    // Add active class to corresponding nav button
    if (sectionId === 'view-events') {
      this.viewEventsBtn.classList.add('active');
    } else if (sectionId === 'create-event') {
      this.createEventBtn.classList.add('active');
    }
  }

  resetEventForm() {
    document.querySelector('#event-title').value = '';
    document.querySelector('#event-description').value = '';
    document.querySelector('#event-start').value = '';
    document.querySelector('#event-end').value = '';
    document.querySelector('#event-location').value = '';
    document.querySelector('#event-category').value = '';
  }

  updateCreateEventButtonVisibility() {
    if (this.isModerator) {
      this.createEventBtn.style.display = 'block';
    } else {
      this.createEventBtn.style.display = 'none';
    }
  }

  handleCreateEvent(e) {
    e.preventDefault();
    const title = document.querySelector('#event-title').value.trim();
    const description = document.querySelector('#event-description').value.trim();
    const startTime = document.querySelector('#event-start').value;
    const endTime = document.querySelector('#event-end').value;
    const location = document.querySelector('#event-location').value.trim();
    const category = document.querySelector('#event-category').value;

    if (!title || !startTime || !category) {
      alert('Please fill in all required fields.');
      return;
    }

    // Validate dates
    const startDate = new Date(startTime);
    const endDate = endTime ? new Date(endTime) : null;
    const now = new Date();

    if (startDate <= now) {
      alert('Event start time must be in the future.');
      return;
    }

    if (endDate && endDate <= startDate) {
      alert('Event end time must be after start time.');
      return;
    }

    postWebViewMessage({
      type: 'createEvent',
      data: {
        title,
        description,
        startTime,
        endTime: endTime || '',
        location,
        category
      }
    });
  }

  renderEvents() {
    const filteredEvents = this.events.filter(event => {
      if (!this.currentFilter) return true;
      return event.category === this.currentFilter;
    });

    if (filteredEvents.length === 0) {
      this.eventsList.innerHTML = '<p class="no-events">No events found matching your criteria.</p>';
      return;
    }

    // Sort events by start time
    filteredEvents.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    this.eventsList.innerHTML = filteredEvents.map(event => this.renderEventCard(event)).join('');

    // Add event listeners to RSVP and delete buttons
    this.eventsList.querySelectorAll('.btn-rsvp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const eventId = e.target.dataset.eventId;
        postWebViewMessage({ type: 'rsvpEvent', data: { eventId } });
      });
    });

    this.eventsList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const eventId = e.target.dataset.eventId;
        if (confirm('Are you sure you want to delete this event?')) {
          postWebViewMessage({ type: 'deleteEvent', data: { eventId } });
        }
      });
    });

    // Update countdowns
    this.updateCountdowns();
  }

  renderEventCard(event) {
    const startDate = new Date(event.startTime);
    const endDate = event.endTime ? new Date(event.endTime) : null;
    const now = new Date();
    
    const isUserRsvped = event.rsvps.some(rsvp => rsvp.userId === this.username);
    const canDelete = event.creator === this.username;
    
    let status = 'upcoming';
    let statusText = 'Upcoming';
    
    if (endDate && now > endDate) {
      status = 'ended';
      statusText = 'Ended';
    } else if (now >= startDate) {
      status = 'live';
      statusText = 'Live Now!';
    }

    const countdown = this.getCountdown(startDate, now, status);

    return `
      <div class="event-card">
        <div class="event-header">
          <h3 class="event-title">${this.escapeHtml(event.title)}</h3>
          <span class="event-category">${this.escapeHtml(event.category)}</span>
        </div>
        
        ${event.description ? `<p class="event-description">${this.escapeHtml(event.description)}</p>` : ''}
        
        <div class="event-details">
          <div class="event-detail">
            <strong>Start:</strong> ${this.formatDateTime(startDate)}
          </div>
          ${endDate ? `<div class="event-detail"><strong>End:</strong> ${this.formatDateTime(endDate)}</div>` : ''}
          ${event.location ? `<div class="event-detail"><strong>Location:</strong> ${this.escapeHtml(event.location)}</div>` : ''}
          <div class="event-detail">
            <strong>Creator:</strong> ${this.escapeHtml(event.creator)}
          </div>
          <div class="event-detail">
            <strong>Status:</strong> <span class="status-${status}">${statusText}</span>
          </div>
        </div>
        
        <div class="event-actions">
          <button class="btn-rsvp ${isUserRsvped ? 'rsvped' : ''}" data-event-id="${event.id}">
            ${isUserRsvped ? '✓ RSVP\'d' : 'RSVP'}
          </button>
          <span class="rsvp-count">${event.rsvps.length} attending</span>
          ${countdown ? `<span class="countdown">${countdown}</span>` : ''}
          ${canDelete ? `<button class="btn-delete" data-event-id="${event.id}">Delete</button>` : ''}
        </div>
      </div>
    `;
  }

  getCountdown(startDate, now, status) {
    if (status !== 'upcoming') return null;
    
    const diff = startDate - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return 'Starting soon!';
    }
  }

  updateCountdowns() {
    // Update countdowns every minute
    setTimeout(() => {
      this.renderEvents();
    }, 60000);
  }

  formatDateTime(date) {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Sends a message to the Devvit app.
 * @arg {WebViewMessage} msg
 * @return {void}
 */
function postWebViewMessage(msg) {
  parent.postMessage(msg, '*');
}

new EventSchedulerApp();