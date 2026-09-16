// editor.js — passcode gate + CRUD for the editor page.
// The passcode is never checked in this file: every call below sends it to a
// Supabase function that does the actual comparison server-side.

const PASSCODE_KEY = 'deadlineTrackerPasscode';

const gate = document.getElementById('gate');
const gateForm = document.getElementById('gate-form');
const gateError = document.getElementById('gate-error');
const passcodeInput = document.getElementById('passcode-input');
const editorEl = document.getElementById('editor');
const cardsEl = document.getElementById('cards');
const addForm = document.getElementById('add-form');
const addError = document.getElementById('add-error');

function getPasscode() {
  return sessionStorage.getItem(PASSCODE_KEY) || '';
}

async function verifyPasscode(code) {
  const { data, error } = await supabaseClient.rpc('verify_passcode', { passcode: code });
  if (error) return false;
  return data === true;
}

async function enterEditor(code) {
  sessionStorage.setItem(PASSCODE_KEY, code);
  gate.hidden = true;
  editorEl.hidden = false;
  await loadEditorCards();
}

gateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  gateError.hidden = true;
  const code = passcodeInput.value.trim();
  const ok = await verifyPasscode(code);
  if (ok) {
    await enterEditor(code);
  } else {
    gateError.hidden = false;
    passcodeInput.value = '';
    passcodeInput.focus();
  }
});

(async function tryStoredPasscode() {
  const stored = sessionStorage.getItem(PASSCODE_KEY);
  if (!stored) return;
  const ok = await verifyPasscode(stored);
  if (ok) {
    await enterEditor(stored);
  } else {
    sessionStorage.removeItem(PASSCODE_KEY);
  }
})();

async function loadEditorCards() {
  await refreshCards(cardsEl, {
    editable: true,
    onEdit: openEditForm,
    onDelete: handleDelete,
  });
}

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  addError.hidden = true;

  const subject = document.getElementById('add-subject').value.trim();
  const name = document.getElementById('add-name').value.trim();
  const type = document.getElementById('add-type').value.trim();
  const date = document.getElementById('add-date').value;

  const { error } = await supabaseClient.rpc('add_assignment', {
    passcode: getPasscode(),
    p_subject: subject,
    p_assignment_name: name,
    p_assignment_type: type,
    p_due_date: date,
  });

  if (error) {
    addError.textContent = `Couldn't add assignment: ${error.message}`;
    addError.hidden = false;
    return;
  }

  addForm.reset();
  await loadEditorCards();
});

async function handleDelete(assignment, cardEl) {
  const confirmed = confirm(`Delete "${assignment.assignment_name}" (${assignment.subject})?`);
  if (!confirmed) return;

  const { error } = await supabaseClient.rpc('delete_assignment', {
    passcode: getPasscode(),
    p_id: assignment.id,
  });

  if (error) {
    alert(`Couldn't delete: ${error.message}`);
    return;
  }
  await loadEditorCards();
}

function openEditForm(assignment, cardEl) {
  const form = document.createElement('form');
  form.className = 'edit-form';
  form.innerHTML = `
    <div class="field">
      <label>Subject</label>
      <input class="e-subject" value="${escapeHtml(assignment.subject)}" required>
    </div>
    <div class="field">
      <label>Assignment name</label>
      <input class="e-name" value="${escapeHtml(assignment.assignment_name)}" required>
    </div>
    <div class="field">
      <label>Type</label>
      <input class="e-type" list="type-options" value="${escapeHtml(assignment.assignment_type)}" required>
    </div>
    <div class="field">
      <label>Due date</label>
      <input type="date" class="e-date" value="${assignment.due_date}" required>
    </div>
    <label class="checkbox-field">
      <input type="checkbox" class="e-extended" ${assignment.is_extended ? 'checked' : ''}>
      Extended
    </label>
    <div class="field e-extended-date-field" ${assignment.is_extended ? '' : 'hidden'}>
      <label>New date</label>
      <input type="date" class="e-extended-date" value="${assignment.extended_date || ''}">
    </div>
    <div class="edit-actions">
      <button type="submit" class="btn btn-save">Save</button>
      <button type="button" class="btn btn-cancel">Cancel</button>
    </div>
    <p class="form-error e-error" hidden></p>
  `;

  const extendedCheckbox = form.querySelector('.e-extended');
  const extendedDateField = form.querySelector('.e-extended-date-field');
  extendedCheckbox.addEventListener('change', () => {
    extendedDateField.hidden = !extendedCheckbox.checked;
  });

  form.querySelector('.btn-cancel').addEventListener('click', () => {
    form.replaceWith(cardEl);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = form.querySelector('.e-error');
    errorEl.hidden = true;

    const isExtended = extendedCheckbox.checked;
    const extendedDate = isExtended ? form.querySelector('.e-extended-date').value : null;

    if (isExtended && !extendedDate) {
      errorEl.textContent = 'Pick a new date, or uncheck Extended.';
      errorEl.hidden = false;
      return;
    }

    const { error } = await supabaseClient.rpc('update_assignment', {
      passcode: getPasscode(),
      p_id: assignment.id,
      p_subject: form.querySelector('.e-subject').value.trim(),
      p_assignment_name: form.querySelector('.e-name').value.trim(),
      p_assignment_type: form.querySelector('.e-type').value.trim(),
      p_due_date: form.querySelector('.e-date').value,
      p_is_extended: isExtended,
      p_extended_date: extendedDate,
    });

    if (error) {
      errorEl.textContent = `Couldn't save: ${error.message}`;
      errorEl.hidden = false;
      return;
    }

    await loadEditorCards();
  });

  cardEl.replaceWith(form);
}
