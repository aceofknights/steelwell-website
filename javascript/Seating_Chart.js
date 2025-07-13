// Global references
const studentInput = document.getElementById('studentName');
const addNameBtn = document.getElementById('addNameBtn');
const addTableBtn = document.getElementById('addTableBtn');
const studentList = document.getElementById('studentList');
const classroom = document.getElementById('classroom');

const seatColors = ['gray', 'red', 'blue', 'green', 'orange', 'purple', 'teal'];
let dragData = null;

// Store manually added student names here
let manualStudentNames = new Set();

// --- Add student from input box to the student list (manual add) ---
function addStudent() {
  const name = studentInput.value.trim();
  if (name === '') {
    alert('Please enter a name.');
    return;
  }
  manualStudentNames.add(name);
  updateStudentList();
  studentInput.value = '';
  saveTables(); // save persistence since student list changed
}

// --- Update the student list on left panel ---
// Combines manual names + all seat assigned names, sorted, no duplicates
function updateStudentList() {
  const namesSet = new Set(manualStudentNames);
  classroom.querySelectorAll('.seat').forEach(seat => {
    const name = seat.dataset.studentName.trim();
    if (name) namesSet.add(name);
  });
  studentList.innerHTML = '';
  Array.from(namesSet)
    .sort((a, b) => a.localeCompare(b))
    .forEach(name => {
      const li = document.createElement('li');
      li.textContent = name;
      studentList.appendChild(li);
    });
}

// --- Save current tables and manual names to localStorage ---
function saveTables() {
  const tables = [];
  classroom.querySelectorAll('.table').forEach(tableDiv => {
    const id = tableDiv.dataset.id;
    const seatCount = parseInt(tableDiv.querySelector('.seat-count').value);
    const seatColor = tableDiv.querySelector('.seat-color').value;
    const posX = parseInt(tableDiv.style.left, 10) || 20;
    const posY = parseInt(tableDiv.style.top, 10) || 20;

    const seats = [];
    tableDiv.querySelectorAll('.seat').forEach(seat => {
      seats.push(seat.dataset.studentName || '');
    });

    tables.push({
      id,
      seatCount,
      seatColor,
      posX,
      posY,
      seats,
    });
  });
  const saveObj = {
    tables,
    manualStudentNames: Array.from(manualStudentNames),
  };
  localStorage.setItem('seatingChartData', JSON.stringify(saveObj));
}

// --- Load tables and manual students from localStorage ---
function loadTables() {
  const saved = localStorage.getItem('seatingChartData');
  if (saved) {
    const { tables = [], manualStudentNames: manualNames = [] } = JSON.parse(saved);
    manualStudentNames = new Set(manualNames);
    tables.forEach(tableData => createTable(tableData));
    updateStudentList();
  }
}

// --- Generate unique ID ---
function generateId() {
  return 'table-' + Math.random().toString(36).substr(2, 9);
}

// --- Create a table and append to classroom ---
function createTable(data = {}) {
  const tableDiv = document.createElement('div');
  tableDiv.classList.add('table');
  tableDiv.dataset.id = data.id || generateId();

  // Position or default
  tableDiv.style.left = (data.posX || 20) + 'px';
  tableDiv.style.top = (data.posY || 20) + 'px';

  // Controls container
  const controlsDiv = document.createElement('div');
  controlsDiv.classList.add('table-controls');

  // Seat count selector
  const seatCountSelect = document.createElement('select');
  seatCountSelect.classList.add('seat-count');
  for (let i = 1; i <= 8; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i + ' seat' + (i > 1 ? 's' : '');
    seatCountSelect.appendChild(opt);
  }
  seatCountSelect.value = data.seatCount || 6;
  controlsDiv.appendChild(seatCountSelect);

  // Seat color selector
  const colorSelect = document.createElement('select');
  colorSelect.classList.add('seat-color');
  seatColors.forEach(color => {
    const opt = document.createElement('option');
    opt.value = color;
    opt.textContent = color.charAt(0).toUpperCase() + color.slice(1);
    colorSelect.appendChild(opt);
  });
  colorSelect.value = data.seatColor || 'gray';
  controlsDiv.appendChild(colorSelect);

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.classList.add('delete-btn');
  controlsDiv.appendChild(deleteBtn);

  tableDiv.appendChild(controlsDiv);

  // Seats container
  const seatsDiv = document.createElement('div');
  seatsDiv.classList.add('seats');
  tableDiv.appendChild(seatsDiv);

  classroom.appendChild(tableDiv);

  // Render seats based on count, color, and assigned names
  function renderSeats() {
    seatsDiv.innerHTML = '';
    const count = parseInt(seatCountSelect.value);
    const color = colorSelect.value;
    const assignedNames = data.seats || [];

    for (let i = 0; i < count; i++) {
      const seat = document.createElement('div');
      seat.classList.add('seat');
      seat.style.backgroundColor = color;
      seat.dataset.seatIndex = i;

      const studentName = assignedNames[i] || '';

      if (studentName) {
        seat.textContent = studentName[0].toUpperCase();
        seat.title = studentName;
        seat.dataset.studentName = studentName;
      } else {
        seat.textContent = '';
        seat.title = 'Click to assign student';
        seat.dataset.studentName = '';
      }

      // Tooltip for full name on hover
      const tooltip = document.createElement('div');
      tooltip.classList.add('seat-tooltip');
      tooltip.textContent = studentName;
      seat.appendChild(tooltip);

      // Seat click to assign student name
      seat.addEventListener('click', () => {
        const newName = prompt('Enter student name for this seat:', seat.dataset.studentName);
        if (newName === null) return;

        const trimmed = newName.trim();
        seat.dataset.studentName = trimmed;
        if (trimmed.length > 0) {
          seat.textContent = trimmed[0].toUpperCase();
          tooltip.textContent = trimmed;
          seat.title = trimmed;
          seat.appendChild(tooltip);
        } else {
          seat.textContent = '';
          tooltip.textContent = '';
          seat.title = 'Click to assign student';
        }
        updateStudentList();
        saveTables();
      });

      seatsDiv.appendChild(seat);
    }
  }

  renderSeats();

  // Event listeners for controls
  seatCountSelect.addEventListener('change', () => {
    // Trim assigned names array if needed
    if (!data.seats) data.seats = [];
    data.seats = data.seats.slice(0, seatCountSelect.value);
    renderSeats();
    saveTables();
    updateStudentList();
  });

  colorSelect.addEventListener('change', () => {
    renderSeats();
    saveTables();
  });

  // Delete table
  deleteBtn.addEventListener('click', () => {
    tableDiv.remove();
    saveTables();
    updateStudentList();
  });

  // Drag & drop
  tableDiv.addEventListener('mousedown', e => {
    // Ignore drag if clicking on controls
    if (['SELECT', 'BUTTON'].includes(e.target.tagName)) return;

    dragData = {
      elem: tableDiv,
      offsetX: e.clientX - tableDiv.getBoundingClientRect().left,
      offsetY: e.clientY - tableDiv.getBoundingClientRect().top,
    };
    tableDiv.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', e => {
    if (!dragData) return;

    const x = e.clientX - dragData.offsetX;
    const y = e.clientY - dragData.offsetY;

    const parentRect = classroom.getBoundingClientRect();
    const elemRect = dragData.elem.getBoundingClientRect();

    let newX = Math.min(Math.max(0, x - parentRect.left), parentRect.width - elemRect.width);
    let newY = Math.min(Math.max(0, y - parentRect.top), parentRect.height - elemRect.height);

    dragData.elem.style.left = newX + 'px';
    dragData.elem.style.top = newY + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (dragData) {
      dragData.elem.style.cursor = 'grab';
      dragData = null;
      saveTables();
    }
  });

  return tableDiv;
}

// Initialize event listeners and load saved data
function init() {
  addNameBtn.addEventListener('click', addStudent);
  addTableBtn.addEventListener('click', () => {
    createTable();
    saveTables();
  });
  loadTables();
}

window.addEventListener('DOMContentLoaded', init);
