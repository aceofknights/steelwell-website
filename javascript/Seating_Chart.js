
const addTableBtn = document.getElementById('addTableBtn');
const studentList = document.getElementById('studentList');
const classroom = document.getElementById('classroom');
const seatColors = ['gray', 'pink', '#ff06ff', 'orange', 'blue', 'lightblue', 'yellow', 'green', 'purple', 'red'];
let dragData = null;
let currentClass = 'default'; // default starting class
let classList = [];           // list of all classes (persisted)
console.log('INITIAL loadClassList():', localStorage.getItem('classList'));

// Each class’s data saved separately in localStorage, key = `seatingChartData_${className}`
function getStorageKey(className) {
  return `seatingChartData_${className}`;
}

function saveCurrentClassData() {
  saveTables(); 
}


function loadClassData(className) {
  const saved = localStorage.getItem(getStorageKey(className));
  if (!saved) {
    manualStudentNames = new Set();
    studentsData = {};
    clearTables();
    return;
  }
  const { tables = [], manualStudentNames: manualNames = [], studentsData: savedStudentsData = {} } = JSON.parse(saved);
  manualStudentNames = new Set(manualNames);
  studentsData = savedStudentsData;
  clearTables();
  tables.forEach(tableData => createTable(tableData));
  updateStudentList();
  updateSeatsFromLocked(true);
}

function saveClassList() {
  localStorage.setItem('classList', JSON.stringify(classList));
}

function loadClassList() {
  const saved = localStorage.getItem('classList');
  classList = saved ? JSON.parse(saved) : ['default'];
  if (!classList.includes('default')) classList.push('default');
}

const classSelector = document.getElementById('classSelector');
const addClassBtn = document.getElementById('addClassBtn');
const deleteClassBtn = document.getElementById('deleteClassBtn');

deleteClassBtn.addEventListener('click', () => {
  if (currentClass === 'default') {
    alert("You cannot delete the default class.");
    return;
  }

  if (!confirm(`Are you sure you want to delete the class "${currentClass}"? This action cannot be undone.`)) {
    return;
  }

  // Remove class data from localStorage
  localStorage.removeItem(getStorageKey(currentClass));

  // Remove class from classList array
  const index = classList.indexOf(currentClass);
  if (index !== -1) {
    classList.splice(index, 1);
  }

  // Save updated class list
  saveClassList();

  // Switch to default class (or first available)
  currentClass = classList.includes('default') ? 'default' : (classList[0] || null);

  if (currentClass) {
    refreshClassSelector();
    loadClassData(currentClass);
  } else {
    // No classes left - clear UI accordingly
    classSelector.innerHTML = '';
    clearTables();
    manualStudentNames.clear();
    studentsData = {};
    updateStudentList();
  }
});


function refreshClassSelector() {
  classSelector.innerHTML = '';
  classList.forEach(cls => {
    const option = document.createElement('option');
    option.value = cls;
    option.textContent = cls;
    classSelector.appendChild(option);
  });
  classSelector.value = currentClass;
}

classSelector.addEventListener('change', () => {
  // Save current class data before switching
  saveCurrentClassData();

  currentClass = classSelector.value;
  loadClassData(currentClass);
});

addClassBtn.addEventListener('click', () => {
  const newClassName = prompt('Enter new class name:');
  console.log('Adding class:', newClassName);

  if (!newClassName) return;
  if (classList.includes(newClassName)) {
    alert('Class already exists!');
    return;
  }
  // Save current class before switching
  saveCurrentClassData();

  classList.push(newClassName);
  currentClass = newClassName;
  saveClassList();
  refreshClassSelector();
  console.log('Refreshed class dropdown:', classList);

  loadClassData(currentClass);
});



// Store manually added student names here
let manualStudentNames = new Set();

// Store extra student data: lockedSeat = {tableName, seatIndex}, blacklist = [names]
let studentsData = {};

// --- Add student from input box to the student list (manual add) ---
function addStudent() {
  // const name = studentInput.value.trim();
  if (name === '') {
    alert('Please enter a name.');
    return;
  }
  if (manualStudentNames.has(name)) {
    alert('Student already exists.');
    return;
  }
  manualStudentNames.add(name);
  if (!studentsData[name]) {
    studentsData[name] = { lockedSeat: null, blacklist: [] };
  }
  updateStudentList();
  // studentInput.value = '';
  saveTables();
}

// --- Update the student list on left panel ---
// Combines manual names + all seat assigned names, sorted, no duplicates
function updateStudentList() {
  // --- Gather all student names from manual list + assigned seats ---
  const namesSet = new Set(manualStudentNames);
  classroom.querySelectorAll('.seat').forEach(seat => {
  const name = seat.dataset.studentName?.trim();
  if (name && studentsData[name]) {
    namesSet.add(name);
  }
});

  // --- Ensure studentsData has all names ---
  namesSet.forEach(name => {
    if (!studentsData[name]) {
      studentsData[name] = { lockedSeat: null, lockedTable: null, blacklist: [] };
    }
  });

  studentList.innerHTML = '';

  // --- Clear All Students Button ---
  const clearAllBtn = document.createElement('button');
  clearAllBtn.textContent = 'Clear All Students';
  clearAllBtn.classList.add('clear-all-students-btn');
  clearAllBtn.style.marginBottom = '10px';
  clearAllBtn.style.display = 'block';
  clearAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to remove ALL students? This cannot be undone.')) {
      manualStudentNames.clear();
      for (const name in studentsData) {
        delete studentsData[name];
      }
      updateStudentList();
      updateSeatsFromLocked(true);
      saveTables();
    }
  });
  studentList.appendChild(clearAllBtn);

  // --- Render Sorted Student Names ---
  const namesArray = Array.from(namesSet).sort((a, b) => a.localeCompare(b));
  
  
  namesArray.forEach(name => {
  const li = document.createElement('li');
  li.dataset.student = name;
  li.style.display = 'flex';
  li.style.alignItems = 'center';
  li.style.justifyContent = 'space-between';
  li.style.gap = '8px';

  const nameSpan = document.createElement('span');
  nameSpan.textContent = name;
  nameSpan.style.flex = '1';
  nameSpan.style.whiteSpace = 'nowrap';
  nameSpan.style.overflow = 'hidden';
  nameSpan.style.textOverflow = 'ellipsis';
  li.appendChild(nameSpan);

  const buttonGroup = document.createElement('div');
  buttonGroup.style.flexShrink = '0';
  buttonGroup.style.display = 'flex';
  buttonGroup.style.gap = '4px';

  // === Attendance Checkbox ===
  const attendanceBtn = document.createElement('input');
  attendanceBtn.type = 'checkbox';
  attendanceBtn.checked = studentsData[name]?.present !== false;
  attendanceBtn.classList.add('attendance-btn');
  buttonGroup.appendChild(attendanceBtn);

  attendanceBtn.addEventListener('change', () => {
    if (!studentsData[name]) {
      studentsData[name] = { lockedSeat: null, lockedTable: null, blacklist: [], present: true };
    }
    studentsData[name].present = attendanceBtn.checked;
    saveTables();
  });

  // === Options Button ===
  const optionsBtn = document.createElement('button');
  optionsBtn.classList.add('options-btn');
  optionsBtn.textContent = '⚙️';
  buttonGroup.appendChild(optionsBtn);

  // === Remove Button ===
  const removeBtn = document.createElement('button');
  removeBtn.classList.add('remove-student-btn');
  removeBtn.textContent = '🗑️';
  removeBtn.title = 'Remove student';

  removeBtn.addEventListener('click', () => {
    if (confirm(`Remove ${name} from the student list?`)) {
      delete studentsData[name];
      manualStudentNames.delete(name);

      // Clear this student from all seats
      classroom.querySelectorAll('.seat').forEach(seat => {
        if ((seat.dataset.studentName || '').trim() === name) {
          seat.dataset.studentName = '';
          seat.textContent = '';
          seat.removeAttribute('data-student-name');
        }
      });

      updateStudentList();
      updateSeatsFromLocked();
      saveTables();
    }
  });

  buttonGroup.appendChild(removeBtn);
  li.appendChild(buttonGroup);

  // === Options Panel ===
  const optionsPanel = document.createElement('div');
  optionsPanel.classList.add('options-panel');
  optionsPanel.style.display = 'none';

  // --- Lock type radios ---
  const lockTypeWrapper = document.createElement('div');
  lockTypeWrapper.classList.add('lock-type-wrapper');

  function mkRadio(value, labelText) {
    const id = `lock-${value}-${name}`;
    const r = document.createElement('input');
    r.type = 'radio';
    r.name = `lockType-${name}`;
    r.value = value;
    r.id = id;

    const lab = document.createElement('label');
    lab.htmlFor = id;
    lab.style.marginRight = '8px';
    lab.appendChild(r);
    lab.append(` ${labelText}`);
    return { r, lab };
  }
  

  const noneRadio = mkRadio('none', 'No lock');
  const tableRadio = mkRadio('table', 'Lock to Table');
  const seatRadio  = mkRadio('seat',  'Lock to Seat');

  lockTypeWrapper.appendChild(noneRadio.lab);
  lockTypeWrapper.appendChild(tableRadio.lab);
  lockTypeWrapper.appendChild(seatRadio.lab);
  optionsPanel.appendChild(lockTypeWrapper);

  // --- Table & Seat selects ---
  const seatAssignmentContainer = document.createElement('div');
  seatAssignmentContainer.classList.add('seat-assignment');

  const tableAssignLabel = document.createElement('label');
  tableAssignLabel.textContent = 'Assign Table: ';
  const tableAssignSelect = document.createElement('select');
  tableAssignSelect.classList.add('assign-table');
  tableAssignLabel.appendChild(tableAssignSelect);

  const seatAssignLabel = document.createElement('label');
  seatAssignLabel.textContent = 'Assign Seat: ';
  const seatAssignSelect = document.createElement('select');
  seatAssignSelect.classList.add('assign-seat');
  seatAssignLabel.appendChild(seatAssignSelect);

  seatAssignmentContainer.appendChild(tableAssignLabel);
  seatAssignmentContainer.appendChild(seatAssignLabel);
  optionsPanel.appendChild(seatAssignmentContainer);

  function updateLockUI() {
    const selected = optionsPanel.querySelector(`input[name=lockType-${name}]:checked`);
    const val = selected ? selected.value : 'none';
    tableAssignLabel.style.display = (val === 'none') ? 'none' : 'block';
    seatAssignLabel.style.display = (val === 'seat') ? 'block' : 'none';
  }

  // --- Blacklist Section ---
  const blacklistFieldset = document.createElement('fieldset');
  const blacklistLegend = document.createElement('legend');
  blacklistLegend.textContent = 'Blacklist Students';
  blacklistFieldset.appendChild(blacklistLegend);
  optionsPanel.appendChild(blacklistFieldset);

  // --- Action Buttons ---
  const resetBtn = document.createElement('button');
  resetBtn.classList.add('reset-options-btn');
  resetBtn.textContent = 'Reset';
  resetBtn.style.marginRight = '8px';

  const saveBtn = document.createElement('button');
  saveBtn.classList.add('save-options-btn');
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.classList.add('cancel-options-btn');
  cancelBtn.textContent = 'Cancel';

  optionsPanel.appendChild(resetBtn);
  optionsPanel.appendChild(saveBtn);
  optionsPanel.appendChild(cancelBtn);
  li.appendChild(optionsPanel);
  studentList.appendChild(li);

  // === Helpers ===
  function refreshTableOptions() {
    tableAssignSelect.innerHTML = '';
    const tables = classroom.querySelectorAll('.table');
    tables.forEach(table => {
      const inputName = table.querySelector('.table-name-input');
      const tableName = inputName ? inputName.value.trim() : 'Unnamed Table';
      const option = document.createElement('option');
      option.value = table.dataset.id;
      option.textContent = tableName || 'Unnamed Table';
      tableAssignSelect.appendChild(option);
    });
  }

  function refreshSeatOptions() {
    seatAssignSelect.innerHTML = '';
    const tableId = tableAssignSelect.value;
    const tableDiv = classroom.querySelector(`.table[data-id="${tableId}"]`);
    if (!tableDiv) return;
    const seats = tableDiv.querySelectorAll('.seat');
    seats.forEach((seat, index) => {
      const lockedByOther = Object.entries(studentsData).some(([otherName, data]) => {
        return otherName !== name &&
               data.lockedSeat &&
               data.lockedSeat.tableId === tableId &&
               data.lockedSeat.seatIndex === index;
      });
      if (!lockedByOther) {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `Seat ${index + 1}`;
        seatAssignSelect.appendChild(option);
      }
    });
  }

  function refreshBlacklistOptions() {
    blacklistFieldset.innerHTML = '';
    blacklistFieldset.appendChild(blacklistLegend);
    const others = namesArray.filter(n => n !== name);
    others.forEach(other => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = other;
      checkbox.id = `blacklist-${name}-${other}`;
      checkbox.checked = studentsData[name]?.blacklist?.includes(other);

      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.textContent = other;

      blacklistFieldset.appendChild(checkbox);
      blacklistFieldset.appendChild(label);
      blacklistFieldset.appendChild(document.createElement('br'));
    });
  }

  // === Events ===
  optionsBtn.addEventListener('click', () => {
    if (optionsPanel.style.display === 'none') {
      refreshTableOptions();
      refreshBlacklistOptions();

      const sData = studentsData[name] || {};
      if (sData.lockedSeat) {
        seatRadio.r.checked = true;
        tableAssignSelect.value = sData.lockedSeat.tableId || '';
        refreshSeatOptions();
        seatAssignSelect.value = String(sData.lockedSeat.seatIndex);
      } else if (sData.lockedTable) {
        tableRadio.r.checked = true;
        tableAssignSelect.value = sData.lockedTable;
        refreshSeatOptions();
      } else {
        noneRadio.r.checked = true;
      }

      updateLockUI();
      optionsPanel.style.display = 'block';
    } else {
      optionsPanel.style.display = 'none';
    }
  });

  lockTypeWrapper.addEventListener('change', updateLockUI);
  tableAssignSelect.addEventListener('change', refreshSeatOptions);

  resetBtn.addEventListener('click', () => {
    if (confirm(`Reset all settings for ${name}?`)) {
      if (studentsData[name]) {
        studentsData[name].lockedSeat = null;
        studentsData[name].lockedTable = null;
        studentsData[name].blacklist = [];
      }
      optionsPanel.style.display = 'none';
      updateStudentList();
      saveTables();
    }
  });

  saveBtn.addEventListener('click', () => {
    const selected = optionsPanel.querySelector(`input[name=lockType-${name}]:checked`);
    const lockVal = selected ? selected.value : 'none';

    if ((lockVal === 'table' || lockVal === 'seat') && !tableAssignSelect.value) {
      alert('Please select a table.');
      return;
    }
    if (lockVal === 'seat' && !seatAssignSelect.value) {
      alert('Please select a seat.');
      return;
    }

    if (!studentsData[name]) {
      studentsData[name] = { lockedSeat: null, lockedTable: null, blacklist: [], present: true };
    }

    if (lockVal === 'seat') {
      studentsData[name].lockedSeat = {
        tableId: tableAssignSelect.value,
        seatIndex: parseInt(seatAssignSelect.value, 10)
      };
      studentsData[name].lockedTable = null;
    } else if (lockVal === 'table') {
      studentsData[name].lockedTable = tableAssignSelect.value;
      studentsData[name].lockedSeat = null;
    } else {
      studentsData[name].lockedSeat = null;
      studentsData[name].lockedTable = null;
    }

    const checkedBoxes = blacklistFieldset.querySelectorAll('input[type=checkbox]:checked');
    studentsData[name].blacklist = Array.from(checkedBoxes).map(cb => cb.value);

    optionsPanel.style.display = 'none';
    updateSeatsFromLocked();
    updateStudentList();
    saveTables();
  });

  cancelBtn.addEventListener('click', () => {
    optionsPanel.style.display = 'none';
  });
});

}



// --- Apply locked seat & table assignments to seats in UI ---
function updateSeatsFromLocked(suppressVisual = false) {
  // Clear all seats first
  classroom.querySelectorAll('.seat').forEach(seat => {
    seat.dataset.studentName = '';
    seat.textContent = '';
    seat.title = 'Click to assign student';
  });

  // --- STEP 1: Exact seat locks ---
  Object.entries(studentsData).forEach(([student, data]) => {
    if (data.lockedSeat) {
      const { tableId, seatIndex } = data.lockedSeat;
      const table = classroom.querySelector(`.table[data-id="${tableId}"]`);
      if (!table) return;
      const seat = table.querySelectorAll('.seat')[seatIndex];
      if (!seat) return;

      seat.dataset.studentName = student;

      if (!suppressVisual) {
        seat.textContent = student;
        seat.title = student;
      } else {
        seat.textContent = '';
        seat.title = 'Click to assign student';
      }
    }
  });

  // --- STEP 2: Table-only locks ---
  Object.entries(studentsData).forEach(([student, data]) => {
    if (data.lockedTable && !data.lockedSeat) {
      const table = classroom.querySelector(`.table[data-id="${data.lockedTable}"]`);
      if (!table) return;

      // Find the first free seat in this table
      const freeSeat = Array.from(table.querySelectorAll('.seat'))
        .find(seat => !seat.dataset.studentName);

      if (freeSeat) {
        freeSeat.dataset.studentName = student;

        if (!suppressVisual) {
          freeSeat.textContent = student;
          freeSeat.title = student;
        } else {
          freeSeat.textContent = '';
          freeSeat.title = 'Click to assign student';
        }
      }
    }
  });
}




// --- Save current tables and manual names to localStorage ---

function saveTables() {
  if (!currentClass) {
    console.warn('No current class selected, skipping save.');
    return;
  }

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

    const tableNameInput = tableDiv.querySelector('.table-name-input');
    const tableName = tableNameInput ? tableNameInput.value.trim() : '';

    tables.push({
      id,
      seatCount,
      seatColor,
      posX,
      posY,
      seats,
      tableName,
    });
  });

  const saveObj = {
    tables,
    manualStudentNames: Array.from(manualStudentNames),
    studentsData,
  };

  localStorage.setItem(getStorageKey(currentClass), JSON.stringify(saveObj));
}


// --- Load tables and manual students from localStorage ---


function loadTables() {
  if (!currentClass) {
    console.warn('No current class selected, skipping load.');
    return;
  }

  const saved = localStorage.getItem(getStorageKey(currentClass));
  if (saved) {
    const { tables = [], manualStudentNames: manualNames = [], studentsData: savedStudentsData = {} } = JSON.parse(saved);
    manualStudentNames = new Set(manualNames);

    studentsData = savedStudentsData || {};

    // Clear existing tables before loading new ones
    clearTables();

    tables.forEach(tableData => createTable(tableData));
    updateStudentList();
    updateSeatsFromLocked(true); // Suppress visual update
  }
}

function clearTables() {
  while (classroom.firstChild) {
    classroom.removeChild(classroom.firstChild);
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

  // Table name input
  const tableNameInput = document.createElement('input');
  tableNameInput.type = 'text';
  tableNameInput.classList.add('table-name-input');
  tableNameInput.placeholder = 'Table Name';
  tableNameInput.value = data.tableName || '';
  controlsDiv.appendChild(tableNameInput);

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
  deleteBtn.textContent = 'X';
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

      // If locked seat matches this seat, display student from studentsData
      let lockedStudentHere = null;
      for (const [student, sData] of Object.entries(studentsData)) {
        if (
          sData.lockedSeat &&
          sData.lockedSeat.tableId === tableDiv.dataset.id &&
          sData.lockedSeat.seatIndex === i
        ) {
          lockedStudentHere = student;
          break;
        }
      }

      if (lockedStudentHere) {
        seat.dataset.studentName = lockedStudentHere;
        seat.textContent = lockedStudentHere;
        seat.title = lockedStudentHere;
      } else if (assignedNames[i]) {
        seat.dataset.studentName = assignedNames[i];
        seat.textContent = assignedNames[i];
        seat.title = assignedNames[i];
      } else {
        seat.textContent = '';
        seat.dataset.studentName = '';
        seat.title = 'Click to assign student';
      }

      // Tooltip for full name on hover
      const tooltip = document.createElement('div');
      tooltip.classList.add('seat-tooltip');
      tooltip.textContent = seat.dataset.studentName;
      seat.appendChild(tooltip);

      // Seat click to assign student name manually
      seat.addEventListener('click', () => {
        const newName = prompt('Enter student name for this seat:', seat.dataset.studentName);
        if (newName === null) return;

        const trimmed = newName.trim();
        if (trimmed && !manualStudentNames.has(trimmed)) {
          manualStudentNames.add(trimmed);
          if (!studentsData[trimmed]) studentsData[trimmed] = { lockedSeat: null, blacklist: [] };
          updateStudentList();
        }

        // Only allow manual assignment if seat is NOT locked by options panel
        let isLockedSeat = false;
        for (const [student, sData] of Object.entries(studentsData)) {
          if (
            sData.lockedSeat &&
            sData.lockedSeat.tableId === tableDiv.dataset.id &&
            sData.lockedSeat.seatIndex === parseInt(seat.dataset.seatIndex)
          ) {
            isLockedSeat = true;
            break;
          }
        }
        if (isLockedSeat) {
          alert('This seat is locked via options. Please use the options panel to change assignment.');
          return;
        }

        seat.dataset.studentName = trimmed;
        if (trimmed.length > 0) {
          seat.textContent = trimmed;
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

  tableNameInput.addEventListener('input', () => {
    saveTables();
    updateStudentList();
  });

  // Delete table
  deleteBtn.addEventListener('click', () => {
    tableDiv.remove();

    // Remove locked seats assigned to this table
    for (const [student, sData] of Object.entries(studentsData)) {
      if (sData.lockedSeat && sData.lockedSeat.tableId === tableDiv.dataset.id) {
        studentsData[student].lockedSeat = null;
      }
    }

    saveTables();
    updateStudentList();
  });

  // Drag & drop
  tableDiv.addEventListener('mousedown', e => {
    if (['SELECT', 'BUTTON', 'INPUT', 'LABEL'].includes(e.target.tagName)) return;

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

// Utility: Randomly shuffle an array (Fisher-Yates shuffle)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// --- Randomize seating assignment ---
// 1. Assign locked seats
// 2. Assign students with blacklists (respecting restrictions)
// 3. Assign all remaining students randomly
function randomizeSeating() {
  // Step 0: present students only
  const allStudents = Array.from(manualStudentNames).filter(
    name => studentsData[name]?.present !== false
  );

  const tables = Array.from(classroom.querySelectorAll('.table'));
  const totalSeats = tables.reduce((sum, table) => {
    const count = parseInt(table.querySelector('.seat-count').value, 10) || 0;
    return sum + count;
  }, 0);

  if (totalSeats < allStudents.length) {
    alert(`Not enough seats! You have ${allStudents.length} present students but only ${totalSeats} seats.`);
    return;
  }

  // seatsMap: { tableId: [null, null, ...] }
  const seatsMap = {};
  tables.forEach(table => {
    const count = parseInt(table.querySelector('.seat-count').value, 10) || 0;
    seatsMap[table.dataset.id] = new Array(count).fill(null);
  });

  function removeFromPool(student) {
    const idx = allStudents.indexOf(student);
    if (idx !== -1) allStudents.splice(idx, 1);
  }

  // --- helper: blacklist + locks check for a seat
  function canSitAtSeat(student, tableId, seatIndex, currentSeatsMap) {
    const data = studentsData[student] || {};
    const blacklist = data.blacklist || [];
    const row = currentSeatsMap[tableId];
    if (!row || row[seatIndex] !== null) return false;

    // enforce table-only lock
    if (data.lockedTable && tableId !== data.lockedTable) return false;

    // enforce exact-seat lock (safety net)
    if (data.lockedSeat) {
      if (data.lockedSeat.tableId !== tableId || data.lockedSeat.seatIndex !== seatIndex) return false;
    }

    // mutual blacklist check within the same table
    for (let i = 0; i < row.length; i++) {
      const other = row[i];
      if (!other) continue;
      if (blacklist.includes(other)) return false;
      if ((studentsData[other]?.blacklist || []).includes(student)) return false;
    }
    return true;
  }

  // --- STEP 1: exact seat locks first
  Object.entries(studentsData).forEach(([student, data]) => {
    if (!data || !data.lockedSeat) return;
    if (!allStudents.includes(student)) return; // skip absent students
    const { tableId, seatIndex } = data.lockedSeat;
    if (seatsMap[tableId] && seatsMap[tableId][seatIndex] === null) {
      seatsMap[tableId][seatIndex] = student;
      removeFromPool(student);
    } else {
      console.warn(`Locked seat invalid/taken for ${student} (table=${tableId}, seat=${seatIndex}).`);
    }
  });

  // --- STEP 2: table-only locks (any valid free seat on that table)
  const tableLocked = allStudents.filter(s => {
    const d = studentsData[s];
    return d?.lockedTable && !d?.lockedSeat;
  });

  tableLocked.forEach(student => {
    const tableId = studentsData[student].lockedTable;
    const row = seatsMap[tableId];
    if (!row) {
      console.warn(`Locked table for ${student} does not exist: ${tableId}`);
      return;
    }
    // try every empty seat on that table, shuffled, with blacklist check
    const empties = row.map((v, i) => (v === null ? i : -1)).filter(i => i !== -1);
    shuffleArray(empties);
    let placed = false;
    for (const seatIndex of empties) {
      if (canSitAtSeat(student, tableId, seatIndex, seatsMap)) {
        row[seatIndex] = student;
        placed = true;
        break;
      }
    }
    if (placed) {
      removeFromPool(student);
    } else {
      console.warn(`No valid seat found on locked table for ${student} (${tableId}); will try during main placement.`);
    }
  });

  // --- STEP 3: assign remaining (respecting locks via canSitAtSeat)
  const studentsWithBlacklist = allStudents.filter(s => (studentsData[s]?.blacklist || []).length > 0);
  const studentsWithoutBlacklist = allStudents.filter(s => !(studentsData[s]?.blacklist || []).length);

  shuffleArray(studentsWithBlacklist);
  shuffleArray(studentsWithoutBlacklist);

  function assignStudentsList(studentArr) {
    for (const student of studentArr) {
      let assigned = false;
      // restrict to locked table if present
      const lockedTableId = studentsData[student]?.lockedTable || null;
      const candidateTableIds = lockedTableId ? [lockedTableId] : Object.keys(seatsMap);
      const shuffledTableIds = [...candidateTableIds];
      shuffleArray(shuffledTableIds);

      for (const tableId of shuffledTableIds) {
        const seatIndices = seatsMap[tableId].map((_, i) => i);
        shuffleArray(seatIndices);
        for (const seatIndex of seatIndices) {
          if (canSitAtSeat(student, tableId, seatIndex, seatsMap)) {
            seatsMap[tableId][seatIndex] = student;
            assigned = true;
            break;
          }
        }
        if (assigned) break;
      }
      if (!assigned) {
        console.warn(`Could not place ${student} during initial assignment; will try to resolve later.`);
      }
    }
  }

  assignStudentsList(studentsWithBlacklist);
  assignStudentsList(studentsWithoutBlacklist);

  // --- STEP 4: your existing single-person table balancing (unchanged) ---
  let attempt = 0;
  const maxAttempts = 150;
  while (attempt < maxAttempts) {
    const singlePersonTables = [];
    for (const tableId in seatsMap) {
      const studentsAtTable = seatsMap[tableId].filter(s => s !== null);
      if (studentsAtTable.length === 1) {
        singlePersonTables.push({
          tableId,
          student: studentsAtTable[0],
          seatIndex: seatsMap[tableId].indexOf(studentsAtTable[0])
        });
      }
    }
    if (singlePersonTables.length === 0) break;

    let movedSomeone = false;

    for (const info of singlePersonTables) {
      const { tableId: sourceTableId, student: singleStudent, seatIndex: sourceSeatIndex } = info;

      // do not move students locked to this table or exact seat
      if (studentsData[singleStudent]?.lockedSeat) continue;
      if (studentsData[singleStudent]?.lockedTable === sourceTableId) continue;

      // temporarily remove
      seatsMap[sourceTableId][sourceSeatIndex] = null;

      let movedOut = false;
      const shuffledTableIds = Object.keys(seatsMap);
      shuffleArray(shuffledTableIds);

      // Priority 1: move to a table with exactly 1 student and space
      for (const targetTableId of shuffledTableIds) {
        if (targetTableId === sourceTableId) continue;
        const studentsAtTarget = seatsMap[targetTableId].filter(s => s !== null);
        const emptySeats = seatsMap[targetTableId].filter(s => s === null).length;
        if (emptySeats > 0 && studentsAtTarget.length === 1) {
          const targetIdx = seatsMap[targetTableId].indexOf(null);
          if (canSitAtSeat(singleStudent, targetTableId, targetIdx, seatsMap)) {
            seatsMap[targetTableId][targetIdx] = singleStudent;
            movedOut = true;
            movedSomeone = true;
            break;
          }
        }
      }

      // Priority 2: any table with >1 student and an empty seat
      if (!movedOut) {
        for (const targetTableId of shuffledTableIds) {
          if (targetTableId === sourceTableId) continue;
          const studentsAtTarget = seatsMap[targetTableId].filter(s => s !== null);
          const emptySeats = seatsMap[targetTableId].filter(s => s === null).length;
          if (emptySeats > 0 && studentsAtTarget.length > 1) {
            const targetIdx = seatsMap[targetTableId].indexOf(null);
            if (canSitAtSeat(singleStudent, targetTableId, targetIdx, seatsMap)) {
              seatsMap[targetTableId][targetIdx] = singleStudent;
              movedOut = true;
              movedSomeone = true;
              break;
            }
          }
        }
      }

      // Priority 3: empty table with at least 2 seats
      if (!movedOut) {
        for (const targetTableId of shuffledTableIds) {
          if (targetTableId === sourceTableId) continue;
          const studentsAtTarget = seatsMap[targetTableId].filter(s => s !== null);
          if (studentsAtTarget.length === 0 && seatsMap[targetTableId].length >= 2) {
            const targetIdx = seatsMap[targetTableId].indexOf(null);
            if (canSitAtSeat(singleStudent, targetTableId, targetIdx, seatsMap)) {
              seatsMap[targetTableId][targetIdx] = singleStudent;
              movedOut = true;
              movedSomeone = true;
              break;
            }
          }
        }
      }

      // Fallback: move a flexible student in (no locks, no blacklists)
      if (!movedOut) {
        seatsMap[sourceTableId][sourceSeatIndex] = singleStudent; // put back for now

        const flexible = [];
        for (const tId in seatsMap) {
          seatsMap[tId].forEach((sName, idx) => {
            if (!sName) return;
            const sData = studentsData[sName] || {};
            if (!sData.lockedSeat && !sData.lockedTable && (!sData.blacklist || sData.blacklist.length === 0)) {
              flexible.push({ student: sName, fromTableId: tId, fromIdx: idx });
            }
          });
        }
        shuffleArray(flexible);

        let movedFlexIn = false;
        for (const candidate of flexible) {
          const { student: flexStudent, fromTableId, fromIdx } = candidate;
          if (seatsMap[fromTableId][fromIdx] !== flexStudent) continue;

          seatsMap[fromTableId][fromIdx] = null;
          const targetEmptyIdx = seatsMap[sourceTableId].indexOf(null);
          if (targetEmptyIdx !== -1 && canSitAtSeat(flexStudent, sourceTableId, targetEmptyIdx, seatsMap)) {
            const afterCount = seatsMap[fromTableId].filter(s => s !== null).length;
            if (!(afterCount === 1 && seatsMap[fromTableId].length > 1)) {
              seatsMap[sourceTableId][targetEmptyIdx] = flexStudent;
              movedFlexIn = true;
              movedSomeone = true;
              break;
            }
          }
          seatsMap[fromTableId][fromIdx] = flexStudent;
        }

        if (!movedFlexIn) {
          console.warn(`Could not resolve single-person table for ${singleStudent} at ${sourceTableId}`);
        }
      }
    }

    if (!movedSomeone) break;
    attempt++;
  }

  if (attempt === maxAttempts) {
    console.warn('Reached max attempts resolving single-person tables.');
  }

  // Write assignments back to DOM
  tables.forEach(table => {
    const tableId = table.dataset.id;
    const seatDivs = table.querySelectorAll('.seat');
    seatsMap[tableId].forEach((studentName, i) => {
      const seat = seatDivs[i];
      seat.dataset.studentName = studentName || '';
      if (studentName) {
        seat.textContent = studentName;
        seat.title = studentName;
      } else {
        seat.textContent = '';
        seat.title = 'Click to assign student';
      }
    });
  });

  if (allStudents.length) {
    console.warn('Unplaced students after randomization:', allStudents);
  }

  updateStudentList();
  saveTables();
}




function resetStudentData(studentName) {
  if (!studentsData[studentName]) return;

  // Clear all saved properties
  delete studentsData[studentName].lockedSeat;
  delete studentsData[studentName].blacklist;

  // You can also clear other properties if added later
  // delete studentsData[studentName].somethingElse;

  // Optional: update UI immediately
  updateStudentList();
  saveTables();
}

const studentListContainer = document.getElementById('studentListContainer');
const toggleBtn = document.getElementById('toggleStudentListBtn');


toggleBtn.addEventListener('click', () => {
  studentListContainer.classList.toggle('hidden');
});


// --- Initialize event listeners and load saved data ---
function init() {

  addTableBtn.addEventListener('click', () => {
    createTable();
    saveTables();
  });

  // Add "Randomize Seating" button below existing buttons
  const randomizeBtn = document.createElement('button');
  randomizeBtn.textContent = 'Random seats, or press R';
  randomizeBtn.id = 'randomizeSeatingBtn';
  addTableBtn.parentNode.insertBefore(randomizeBtn, addTableBtn.nextSibling);
  randomizeBtn.addEventListener('click', randomizeSeating);

  loadTables();
}

// ✅ Correct usage: call `init()` after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  loadClassList();
  refreshClassSelector();
  loadClassData(currentClass);
  init(); // only called once here!
});


document.getElementById('bulk-add-btn').addEventListener('click', () => {
  const textarea = document.getElementById('bulk-add-textarea');
  const rawText = textarea.value.trim();
  if (!rawText) return alert('Please paste some student names first.');

  const newNames = rawText.split(/\r?\n/).map(name => name.trim()).filter(name => name.length > 0);
  let addedCount = 0;

  newNames.forEach(name => {
    if (!manualStudentNames.has(name)) {
      manualStudentNames.add(name);
    }

    if (!studentsData[name]) {
      studentsData[name] = { lockedSeat: null, blacklist: [] };
    }
    addedCount++;
  });

  if (addedCount > 0) {
    alert(`Added ${addedCount} students.`);
    updateStudentList();
    saveTables();
  } else {
    alert('No new students to add.');
  }

  textarea.value = '';
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'r') {
    randomizeSeating()
    // Code to execute when the 'r' key is pressed
    console.log('The "r" key was pressed!');
    // Example: Trigger a function or change an element's style
    // someFunction();
    // document.getElementById('myElement').style.backgroundColor = 'red';
  }
});

const fullscreenBtn = document.getElementById('fullscreenClassroomBtn');
const classroomDiv = document.getElementById('classroom');

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    // Request full screen on the classroom div
    if (classroomDiv.requestFullscreen) {
      classroomDiv.requestFullscreen();
    } else if (classroomDiv.webkitRequestFullscreen) { /* Safari */
      classroomDiv.webkitRequestFullscreen();
    } else if (classroomDiv.msRequestFullscreen) { /* IE11 */
      classroomDiv.msRequestFullscreen();
    }
    // Add class to enlarge it
    classroomDiv.classList.add('fullscreen-classroom');
    fullscreenBtn.textContent = 'Exit Fullscreen';
  } else {
    // Exit fullscreen mode
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    // Remove class to revert size
    classroomDiv.classList.remove('fullscreen-classroom');
    fullscreenBtn.textContent = 'Fullscreen Classroom';
  }
});

// Also listen for fullscreen change to sync class toggle & button text (handles ESC key)
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    classroomDiv.classList.remove('fullscreen-classroom');
    fullscreenBtn.textContent = 'Fullscreen Classroom';
  }
});
