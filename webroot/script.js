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
    this.categoryPillsContainer = document.querySelector('#category-filter-pills');
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
    this.initCategoryPills();
  }

  initCategoryPills() {
    this.categoryPillsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('pill')) {
        this.currentFilter = e.target.dataset.category;
        this.renderEvents();

        // Update active pill
        this.categoryPillsContainer.querySelector('.pill.active')?.classList.remove('active');
        e.target.classList.add('active');
      }
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
        this.populateCategoryPills();
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

  populateCategoryPills() {
    const categories = ['All Categories', ...new Set(this.events.map(event => event.category).filter(Boolean))];
    this.categoryPillsContainer.innerHTML = '';

    categories.forEach(category => {
      const pill = document.createElement('div');
      pill.classList.add('pill');
      pill.textContent = category;
      if (category === 'All Categories') {
        pill.dataset.category = '';
        if (this.currentFilter === '') {
          pill.classList.add('active');
        }
      } else {
        pill.dataset.category = category;
        if (this.currentFilter === category) {
          pill.classList.add('active');
        }
      }
      this.categoryPillsContainer.appendChild(pill);
    });
  }

  renderEvents() {
    const filteredEvents = this.events.filter(event => 
      !this.currentFilter || event.category === this.currentFilter
    );

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

    // Icons
    const ICONS = {
      CALENDAR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M17 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4V1h2v2h6V1h2v2zM4 9v10h16V9H4zm2-4v2h12V5H6z"/></svg>`,
      LOCATION: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 20.9l4.95-4.95a7 7 0 1 0-9.9 0L12 20.9zm0-11.31a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>`,
      USER: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M20 22h-2v-2a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3v2H4v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2zm-8-9a6 6 0 1 1 0-12 6 6 0 0 1 0 12zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>`,
      STATUS: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-1-7h2v2h-2v-2zm0-4h2v2h-2V7z"/></svg>`,
      CHECK: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"/></svg>`,
      TICKET: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3V3zm10 4H5v12h14V7zM7 9h2v2H7V9zm0 4h2v2H7v-2zm0 4h2v2H7v-2zm4-4h6v2h-6v-2zm0 4h6v2h-6v-2zm4-8h2v2h-2V9z"/></svg>`,
      TRASH: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M7 6V3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3h5v2h-2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8H2V6h5zm2-2v2h6V4H9zm0 4v10h2V8H9zm4 0v10h2V8h-2z"/></svg>`,
    };
    
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

    const titleHtml = status === 'live' 
      ? `${this.escapeHtml(event.title)} <span class="status-live">${statusText}</span>` 
      : this.escapeHtml(event.title);

    return `
      <div class="event-card">
        <div class="event-header">
          <h3 class="event-title">
            ${titleHtml}
            ${event.category ? `<span class="event-category">${this.escapeHtml(event.category)}</span>` : ''}
          </h3>
        </div>
        
        ${event.description ? `<p class="event-description">${this.escapeHtml(event.description)}</p>` : ''}
        
        <div class="event-details">
          <div class="event-detail full-width">
             ${ICONS.CALENDAR}<span>${this.formatEventDateTimeRange(event.startTime, event.endTime)}</span>
          </div>
          ${event.location ? `<div class="event-detail">${ICONS.LOCATION}<span>${this.escapeHtml(event.location)}</span></div>` : ''}
          <div class="event-detail">
            ${ICONS.USER}<span><strong>${this.escapeHtml(event.creator)}</strong></span>
          </div>
        </div>
        
        <div class="event-actions">
          ${status !== 'ended' ? `
          <button class="btn-rsvp ${isUserRsvped ? 'rsvped' : ''}" data-event-id="${event.id}">
            ${isUserRsvped ? ICONS.CHECK : ICONS.TICKET}
          </button>
          ` : ''}
          <span class="rsvp-count">${event.rsvps.length} ${status !== 'ended' ? 'attending' : 'attended'}</span>
          ${countdown ? `<span class="countdown">${countdown}</span>` : ''}
          
          ${canDelete ? `<button class="btn-delete" data-event-id="${event.id}">${ICONS.TRASH}</button>` : ''}
        </div>
      </div>
    `;
  }

  formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  }

  formatEventDateTimeRange(startDateStr, endDateStr) {
    const startDate = new Date(startDateStr);
    const endDate = endDateStr ? new Date(endDateStr) : null;

    const dateOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };

    const timeOptions = {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    };

    if (!endDate) {
      return startDate.toLocaleString('en-US', { ...dateOptions, ...timeOptions });
    }

    const startDay = startDate.toLocaleDateString('en-US', dateOptions);
    const endDay = endDate.toLocaleDateString('en-US', dateOptions);

    const startTime = startDate.toLocaleTimeString('en-US', timeOptions).replace(' ', '');
    const endTime = endDate.toLocaleTimeString('en-US', timeOptions).replace(' ', '');

    if (startDay === endDay) {
      return `${startDay} • ${startTime} - ${endTime}`;
    } else {
      return `${startDate.toLocaleString('en-US', { ...dateOptions, ...timeOptions })} - ${endDate.toLocaleString('en-US', { ...dateOptions, ...timeOptions })}`;
    }
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