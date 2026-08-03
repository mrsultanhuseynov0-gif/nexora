/**
 * NEXORA Order Timeline — live status UI
 */
(function (global) {
  'use strict';

  var STEPS = [
    { id: 'accepted', status: 'pending', label: 'Qəbul edildi' },
    { id: 'preparing', status: 'paid', label: 'Hazırlanır' },
    { id: 'courier', status: 'shipped', label: 'Kuryerdədir' },
    { id: 'delivered', status: 'delivered', label: 'Çatdırıldı' }
  ];

  var FLOW = ['pending', 'paid', 'shipped', 'delivered'];

  var LOCAL_MAP = {
    'Təsdiqləndi': 'pending',
    'Qəbul edildi': 'pending',
    'Gözləmədə': 'pending',
    'Hazırlanır': 'paid',
    'Ödənildi': 'paid',
    'Göndərildi': 'shipped',
    'Kuryerdədir': 'shipped',
    'Çatdırıldı': 'delivered',
    'Ləğv': 'cancelled',
    'Ləğv edilib': 'cancelled'
  };

  function esc(s) {
    return typeof NexoraSecurity !== 'undefined'
      ? NexoraSecurity.escapeHtml(s)
      : String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function normalizeStatus(status) {
    if (!status) return 'pending';
    if (FLOW.indexOf(status) !== -1 || status === 'cancelled') return status;
    return LOCAL_MAP[status] || 'pending';
  }

  function labelForStatus(status) {
    var s = normalizeStatus(status);
    if (s === 'cancelled') return 'Ləğv edilib';
    for (var i = 0; i < STEPS.length; i++) {
      if (STEPS[i].status === s) return STEPS[i].label;
    }
    return status;
  }

  function buildFromStatus(order) {
    var status = normalizeStatus(order.status);
    var idx = FLOW.indexOf(status);
    if (status === 'cancelled') idx = -1;
    var created = new Date(order.createdAt || Date.now()).getTime();
    var delays = [0, 45e3, 150e3, 300e3];
    return {
      orderId: order.id,
      status: status,
      live: status !== 'cancelled' && status !== 'delivered',
      progress: idx < 0 ? 0 : Math.round(((idx + 1) / STEPS.length) * 100),
      currentStep: status === 'cancelled'
        ? { id: 'cancelled', label: 'Ləğv edilib' }
        : STEPS[Math.max(0, idx)],
      steps: STEPS.map(function (step, i) {
        var done = idx >= i;
        var current = idx === i;
        var at = null;
        if (done || current) {
          at = new Date(Math.min(created + delays[i], Date.now())).toISOString();
        }
        return {
          id: step.id,
          status: step.status,
          label: step.label,
          done: done,
          current: current && status !== 'cancelled',
          at: at
        };
      }),
      updatedAt: order.updatedAt || order.createdAt,
      createdAt: order.createdAt
    };
  }

  function ensureTimeline(order) {
    if (order && order.timeline && order.timeline.steps) return order.timeline;
    return buildFromStatus(order || {});
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('az-AZ', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  }

  function render(timeline, opts) {
    opts = opts || {};
    var tl = timeline || {};
    var steps = tl.steps || [];
    var live = !!tl.live;
    var currentLabel = (tl.currentStep && tl.currentStep.label) || labelForStatus(tl.status);

    var html =
      '<div class="order-timeline' + (live ? ' is-live' : '') + (tl.status === 'cancelled' ? ' is-cancelled' : '') + '"' +
        (tl.orderId ? ' data-order-id="' + esc(tl.orderId) + '"' : '') + '>' +
        '<div class="order-timeline-head">' +
          '<div>' +
            '<div class="order-timeline-kicker">📦 Order Timeline</div>' +
            '<div class="order-timeline-status">' +
              (live ? '<span class="order-live-dot" aria-hidden="true"></span>' : '') +
              '<strong>' + esc(currentLabel) + '</strong>' +
              (live ? '<span class="order-live-tag">Canlı</span>' : '') +
            '</div>' +
          '</div>' +
          (opts.showProgress !== false
            ? '<div class="order-timeline-progress" aria-hidden="true">' +
                '<span style="width:' + esc(tl.progress || 0) + '%"></span></div>'
            : '') +
        '</div>' +
        '<ol class="order-timeline-steps">';

    steps.forEach(function (step) {
      var cls = 'order-timeline-step';
      if (step.done) cls += ' is-done';
      if (step.current) cls += ' is-current';
      html +=
        '<li class="' + cls + '">' +
          '<span class="order-timeline-bullet" aria-hidden="true">' +
            (step.done || step.current ? '🟢' : '⚪') +
          '</span>' +
          '<div class="order-timeline-body">' +
            '<div class="order-timeline-label">' + esc(step.label) + '</div>' +
            (step.at
              ? '<div class="order-timeline-time">' + esc(formatTime(step.at)) + '</div>'
              : (step.current ? '<div class="order-timeline-time">indi</div>' : '')) +
          '</div>' +
        '</li>';
    });

    if (tl.status === 'cancelled') {
      html +=
        '<li class="order-timeline-step is-cancelled">' +
          '<span class="order-timeline-bullet">🔴</span>' +
          '<div class="order-timeline-body"><div class="order-timeline-label">Ləğv edilib</div></div>' +
        '</li>';
    }

    html += '</ol></div>';
    return html;
  }

  function renderCompact(timeline) {
    var tl = timeline || {};
    var steps = tl.steps || [];
    return '<div class="order-timeline-compact" aria-label="Order timeline">' +
      steps.map(function (s) {
        return '<span class="otc-dot' +
          (s.done ? ' is-done' : '') +
          (s.current ? ' is-current' : '') +
          '" title="' + esc(s.label) + '"></span>';
      }).join('<span class="otc-line" aria-hidden="true"></span>') +
      '</div>';
  }

  global.NexoraOrderTimeline = {
    STEPS: STEPS,
    normalizeStatus: normalizeStatus,
    labelForStatus: labelForStatus,
    buildFromStatus: buildFromStatus,
    ensureTimeline: ensureTimeline,
    render: render,
    renderCompact: renderCompact
  };
})(typeof window !== 'undefined' ? window : global);
