/**
 * PlexConcert — Main Interactions
 * Smooth scroll, mobile nav, scroll animations, form handling
 */

(function () {
  // --- Scroll Progress Bar ---
  const scrollProgress = document.getElementById('scrollProgress');

  function updateScrollProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    scrollProgress.style.width = progress + '%';
  }

  // --- Nav scroll state ---
  const nav = document.getElementById('nav');

  function updateNavState() {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  // Combined scroll handler
  window.addEventListener('scroll', () => {
    updateScrollProgress();
    updateNavState();
  }, { passive: true });

  // --- Mobile Nav Toggle ---
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navLinks.classList.toggle('open');
  });

  // Close mobile nav on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.classList.remove('active');
      navLinks.classList.remove('open');
    });
  });

  // --- Scroll Animations (IntersectionObserver) ---
  const fadeElements = document.querySelectorAll('.fade-up');

  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  fadeElements.forEach(el => fadeObserver.observe(el));

  // --- Email Obfuscation ---
  // Assemble email from split data attributes at runtime (prevents bot harvesting)
  const emailEl = document.getElementById('contact-email');
  if (emailEl) {
    const u = emailEl.getAttribute('data-u');
    const d = emailEl.getAttribute('data-d');
    if (u && d) {
      const addr = u + '@' + d;
      emailEl.textContent = addr;
      emailEl.href = 'mailto:' + addr;
    }
  }

  // --- Contact Form (Web3Forms AJAX) ---
  const form = document.getElementById('contactForm');
  const formStatus = document.getElementById('formStatus');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    const accessKey = form.querySelector('input[name="access_key"]').value;

    // If access key isn't configured, show message
    if (accessKey === 'YOUR_ACCESS_KEY') {
      btn.textContent = 'Form not configured yet';
      btn.disabled = true;
      formStatus.textContent = 'Replace YOUR_ACCESS_KEY with your Web3Forms access key.';
      formStatus.className = 'form-status form-status--error';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 3000);
      return;
    }

    // Submit via AJAX
    btn.textContent = 'Sending...';
    btn.disabled = true;
    formStatus.textContent = '';
    formStatus.className = 'form-status';

    try {
      const data = new FormData(form);
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: data,
      });
      const json = await res.json();

      if (json.success) {
        formStatus.textContent = 'Message sent. We\u2019ll be in touch soon.';
        formStatus.className = 'form-status form-status--success';
        form.reset();
        // Re-set hidden fields after reset
        form.querySelector('input[name="access_key"]').value = accessKey;
      } else {
        formStatus.textContent = 'Something went wrong. Please try again.';
        formStatus.className = 'form-status form-status--error';
      }
    } catch (err) {
      formStatus.textContent = 'Network error. Please try again later.';
      formStatus.className = 'form-status form-status--error';
    }

    btn.textContent = originalText;
    btn.disabled = false;
  });

  // --- Smooth scroll for anchor links (fallback for browsers without CSS scroll-behavior) ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
})();
