(() => {
  'use strict';
  const config = window.VETIFLOW_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const dialog = $('#notice-dialog');
  const title = $('#notice-title');
  const description = $('#notice-description');
  const message = $('#form-message');
  const tabs = [...document.querySelectorAll('[data-mode]')];
  const identity = $('#identity');
  const identityLabel = $('#identity-label');
  const fields = $('#login-fields');
  const password = $('#password');
  let mode = 'email';

  function notice(heading, body) {
    title.textContent = heading;
    description.textContent = body;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else window.alert(`${heading}\n\n${body}`);
  }
  $('#dialog-ok').addEventListener('click', () => dialog.close());
  $('#dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

  function showMessage(text, isError = false) {
    message.hidden = !text;
    message.textContent = text;
    message.classList.toggle('error', isError);
  }
  function setMode(nextMode) {
    if (mode === nextMode) return;
    mode = nextMode;
    showMessage('');
    tabs.forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    const isPhone = mode === 'phone';
    fields.setAttribute('aria-labelledby', isPhone ? 'tab-phone' : 'tab-email');
    identityLabel.textContent = isPhone ? 'Phone number' : 'Email address';
    identity.type = isPhone ? 'tel' : 'email';
    identity.inputMode = isPhone ? 'tel' : 'email';
    identity.autocomplete = isPhone ? 'tel' : 'username';
    identity.placeholder = isPhone ? '(555) 000-0000' : 'you@example.com';
    identity.value = isPhone ? '' : 'team@vetiflow.demo';
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const other = tabs[(index + 1) % tabs.length];
      setMode(other.dataset.mode);
      other.focus();
    });
  });
  $('#toggle-password').addEventListener('click', (event) => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    event.currentTarget.setAttribute('aria-pressed', String(show));
    event.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  document.querySelectorAll('[data-connection]').forEach((button) => {
    button.addEventListener('click', () => {
      const isHelp = button.dataset.connection === 'help';
      const target = isHelp ? config.helpUrl : config.forgotPasswordUrl;
      if (target) window.location.assign(target);
      else notice(isHelp ? 'Help is not configured' : 'Password recovery is not configured',
        'Add the correct hospital or VetiFlow support destination in site-config.js before publishing.');
    });
  });
  $('#call-now').addEventListener('click', () => {
    const phone = String(config.emergencyPhone || '').trim();
    if (phone && /^[+\d\s()\-.]{7,24}$/.test(phone)) {
      window.location.href = 'tel:' + phone.replace(/[^+\d]/g, '');
    } else {
      notice('Emergency phone not configured',
        'This is a preview. A real emergency phone number must be added in site-config.js before publishing. If your pet needs immediate care, call your local emergency veterinary hospital directly.');
    }
  });
  $('#directions').addEventListener('click', () => {
    const url = String(config.directionsUrl || '').trim();
    if (/^https:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
    else notice('Directions not configured', 'Add the real hospital maps URL in site-config.js before publishing.');
  });

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = identity.value.trim();
    const secret = password.value;
    if (!user || !secret) { showMessage('Enter your ' + (mode === 'email' ? 'email address' : 'phone number') + ' and password.', true); return; }
    if (mode === 'email' && !identity.checkValidity()) { showMessage('Enter a valid email address.', true); return; }
    if (!config.signInEndpoint) {
      showMessage('Preview only: connect your authentication service in site-config.js to enable secure sign-in.', false);
      return;
    }
    const button = $('#sign-in');
    button.disabled = true;
    showMessage('Signing in…');
    try {
      const response = await fetch(config.signInEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ mode, identity: user, password: secret })
      });
      if (!response.ok) throw new Error('Could not sign in. Please check your credentials or try again.');
      const result = await response.json();
      // Your authentication backend must set its own secure, HttpOnly session cookie.
      // Only navigate to a same-origin path; never trust an arbitrary redirect URL.
      const route = config.afterSignInUrl || '/portal';
      if (!route.startsWith('/') || route.startsWith('//')) throw new Error('Invalid portal destination.');
      if (!result || result.success !== true) throw new Error('Sign-in failed. Please try again.');
      window.location.assign(route);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Sign-in failed. Please try again.', true);
    } finally {
      button.disabled = false;
    }
  });
})();
