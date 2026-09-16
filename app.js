// app.js — shared logic for both the public board and the editor.

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchAssignments() {
  const { data, error } = await supabaseClient.from('assignments').select('*');
  if (error) throw error;
  return data || [];
}

// Whole-day difference between today and a YYYY-MM-DD date string.
function getDaysRemaining(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const diffMs = due.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
}

// The date that actually counts is the extended date, if one is set.
function getStatus(assignment) {
  const effectiveDate = (assignment.is_extended && assignment.extended_date)
    ? assignment.extended_date
    : assignment.due_date;
  const days = getDaysRemaining(effectiveDate);

  let label, statusClass;
  if (days < 0) {
    const n = Math.abs(days);
    label = `Overdue by ${n} day${n === 1 ? '' : 's'}`;
    statusClass = 'overdue';
  } else if (days === 0) {
    label = 'Due today';
    statusClass = 'today';
  } else if (days === 1) {
    label = 'Due tomorrow';
    statusClass = 'tomorrow';
  } else if (days <= 3) {
    label = `Due in ${days} days`;
    statusClass = 'soon';
  } else {
    label = `Due in ${days} days`;
    statusClass = 'upcoming';
  }
  return { effectiveDate, days, label, statusClass };
}

// Nearest upcoming deadline first. Overdue items sink to the bottom, with the
// most recently overdue just below the upcoming list and the longest-overdue
// items at the very end.
function sortAssignments(list) {
  return [...list].sort((a, b) => {
    const sa = getStatus(a), sb = getStatus(b);
    const aOver = sa.days < 0, bOver = sb.days < 0;
    if (aOver !== bOver) return aOver ? 1 : -1;
    if (aOver) return sb.days - sa.days;
    return sa.days - sb.days;
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function createCardElement(assignment, options = {}) {
  const { editable = false, onEdit, onDelete } = options;
  const status = getStatus(assignment);

  const card = document.createElement('article');
  card.className = `card status-${status.statusClass}`;
  card.dataset.id = assignment.id;

  const dateHtml = (assignment.is_extended && assignment.extended_date)
    ? `<span class="date-original">${formatDate(assignment.due_date)}</span>
       <span class="date-arrow">&rarr;</span>
       <span class="date-new">${formatDate(assignment.extended_date)}</span>`
    : `<span class="date-single">${formatDate(assignment.due_date)}</span>`;

  card.innerHTML = `
    <div class="card-top">
      <h2 class="card-subject">${escapeHtml(assignment.subject)}</h2>
      <span class="card-type">${escapeHtml(assignment.assignment_type)}</span>
    </div>
    <p class="card-name">${escapeHtml(assignment.assignment_name)}</p>
    <div class="card-dates">${dateHtml}</div>
    <div class="card-bottom">
      <span class="tag tag-${status.statusClass}">${status.label}</span>
      ${assignment.is_extended ? '<span class="tag tag-extended">Extended</span>' : ''}
    </div>
  `;

  if (editable) {
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-edit';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => onEdit(assignment, card));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-delete';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => onDelete(assignment, card));

    actions.append(editBtn, delBtn);
    card.appendChild(actions);
  }

  return card;
}

async function refreshCards(container, options = {}) {
  container.innerHTML = '<p class="loading">Loading assignments&hellip;</p>';
  try {
    const list = await fetchAssignments();
    const sorted = sortAssignments(list);
    container.innerHTML = '';
    if (sorted.length === 0) {
      container.innerHTML = '<p class="empty">No assignments yet.</p>';
      return sorted;
    }
    sorted.forEach(a => container.appendChild(createCardElement(a, options)));
    return sorted;
  } catch (err) {
    container.innerHTML = `<p class="error">Couldn't load assignments: ${escapeHtml(err.message)}</p>`;
    return [];
  }
}
