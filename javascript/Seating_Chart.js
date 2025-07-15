// Global references
const studentInput = document.getElementById('studentName');
const addNameBtn = document.getElementById('addNameBtn');
const addTableBtn = document.getElementById('addTableBtn');
const studentList = document.getElementById('studentList');
const classroom = document.getElementById('classroom');
// #ff06ff
const seatColors = ['gray', 'pink', '#ff06ff', 'orange', 'blue', 'lightblue', 'yellow', 'green'];
let dragData = null;

// Store manually added student names here
let manualStudentNames = new Set();

// Store extra student data: lockedSeat = {tableName, seatIndex}, blacklist = [names]
let studentsData = {};

// --- Add student from input box to the student list (manual add) ---
function addStudent() {
  const name = studentInput.value.trim();
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
  studentInput.value = '';
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
      studentsData[name] = { lockedSeat: null, blacklist: [] };
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
      manualStudentNames.length = 0;
      for (const name in studentsData) {
        delete studentsData[name];
      }
      updateStudentList();
      updateSeatsFromLocked();
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
    // Remove from studentsData
    delete studentsData[name];

    // Remove from manual list
    const index = manualStudentNames.indexOf(name);
    if (index !== -1) manualStudentNames.splice(index, 1);

    // Clear from all seats
    classroom.querySelectorAll('.seat').forEach(seat => {
      if (seat.dataset.studentName.trim() === name) {
        seat.dataset.studentName = '';
        seat.textContent = '';
            seat.removeAttribute('data-student-name'); // ← ensure this removes ghost data

      }
    });

    updateStudentList();
    updateSeatsFromLocked();  // optional if you want to re-render visual changes
    saveTables();
  }
});

    buttonGroup.appendChild(removeBtn);
    li.appendChild(buttonGroup);

    // === Options Panel ===
    const optionsPanel = document.createElement('div');
    optionsPanel.classList.add('options-panel');
    optionsPanel.style.display = 'none';

    // --- Seat Assignment Toggle ---
    const seatToggleLabel = document.createElement('label');
    seatToggleLabel.textContent = 'Assign Seat? ';
    seatToggleLabel.style.display = 'block';

    const seatToggle = document.createElement('input');
    seatToggle.type = 'checkbox';
    seatToggle.checked = !!studentsData[name].lockedSeat;
    seatToggleLabel.appendChild(seatToggle);
    optionsPanel.appendChild(seatToggleLabel);

    // --- Table & Seat Assignment Selects ---
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

    const seatAssignmentContainer = document.createElement('div');
    seatAssignmentContainer.appendChild(tableAssignLabel);
    seatAssignmentContainer.appendChild(seatAssignLabel);
    seatAssignmentContainer.style.display = seatToggle.checked ? 'block' : 'none';
    optionsPanel.appendChild(seatAssignmentContainer);

    seatToggle.addEventListener('change', () => {
      seatAssignmentContainer.style.display = seatToggle.checked ? 'block' : 'none';
    });

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
    resetBtn.addEventListener('click', () => {
      if (confirm(`Reset all settings for ${name}?`)) {
        delete studentsData[name].lockedSeat;
        delete studentsData[name].blacklist;
        optionsPanel.style.display = 'none';
        updateStudentList();
        saveTables();
      }
    });

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
        const locked = studentsData[name]?.lockedSeat;
        if (locked) {
          seatToggle.checked = true;
          seatAssignmentContainer.style.display = 'block';
          tableAssignSelect.value = locked.tableId || '';
        } else {
          seatToggle.checked = false;
          seatAssignmentContainer.style.display = 'none';
        }
        refreshSeatOptions();
        optionsPanel.style.display = 'block';
      } else {
        optionsPanel.style.display = 'none';
      }
    });

    tableAssignSelect.addEventListener('change', refreshSeatOptions);

    saveBtn.addEventListener('click', () => {
      if (seatToggle.checked) {
        const tableId = tableAssignSelect.value;
        const seatIndex = parseInt(seatAssignSelect.value);
        if (tableId && !isNaN(seatIndex)) {
          studentsData[name].lockedSeat = { tableId, seatIndex };
        }
      } else {
        studentsData[name].lockedSeat = null;
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



// --- Apply locked seat assignments to seats in UI ---
function updateSeatsFromLocked(suppressVisual = false) {
  // Clear all seats first
  classroom.querySelectorAll('.seat').forEach(seat => {
    seat.dataset.studentName = '';
    seat.textContent = '';
    seat.title = 'Click to assign student';
  });

  // Assign locked seats in data only, optionally suppressing visual
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

    // Save table name from input
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
  localStorage.setItem('seatingChartData', JSON.stringify(saveObj));
}

// --- Load tables and manual students from localStorage ---
function loadTables() {
  const saved = localStorage.getItem('seatingChartData');
  if (saved) {
    const { tables = [], manualStudentNames: manualNames = [], studentsData: savedStudentsData = {} } = JSON.parse(saved);
    manualStudentNames = [...manualNames];

    studentsData = savedStudentsData || {};
    tables.forEach(tableData => createTable(tableData));
    updateStudentList();
    updateSeatsFromLocked(true); // Suppress visual

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
        seat.textContent = assignedNames;
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
  // Step 0: Gather all student names and table elements
  const allStudents = Array.from(manualStudentNames);
  const tables = Array.from(classroom.querySelectorAll('.table'));
  // Step 0.5: Check total available seats
  const totalSeats = tables.reduce((sum, table) => {
    const count = parseInt(table.querySelector('.seat-count').value);
    return sum + count;
  }, 0);

  if (totalSeats < allStudents.length) {
    alert(`Not enough seats! You have ${allStudents.length} students but only ${totalSeats} seats.`);
    return;
  }

  // Step 1: Build a seat map representing each table's seats
  // Format: seatsMap = { tableId: [null, null, "StudentName", ...] }
  const seatsMap = {};
  tables.forEach(table => {
    const count = parseInt(table.querySelector('.seat-count').value);
    seatsMap[table.dataset.id] = new Array(count).fill(null);
  });

  // Step 2: Assign locked students to their specific seat positions
  Object.entries(studentsData).forEach(([student, data]) => {
    if (data.lockedSeat) {
      const { tableId, seatIndex } = data.lockedSeat;
      if (seatsMap[tableId] && seatsMap[tableId][seatIndex] === null) {
        seatsMap[tableId][seatIndex] = student;
        const idx = allStudents.indexOf(student);
        if (idx !== -1) allStudents.splice(idx, 1); // Remove from assignment pool
      }
    }
  });

  // Step 3: Categorize remaining students
  const studentsWithBlacklist = allStudents.filter(
    s => studentsData[s]?.blacklist?.length > 0
  );
  const studentsWithoutBlacklist = allStudents.filter(
    s => !studentsData[s]?.blacklist?.length
  );

  // Shuffle both categories for randomness
  shuffleArray(studentsWithBlacklist);
  shuffleArray(studentsWithoutBlacklist);

  // --- Helper function ---
  // Checks if a student can sit at a specific seat of a table
  function canSitAtSeat(student, tableId, seatIndex) {
    const blacklist = studentsData[student]?.blacklist || [];
    const currentTable = seatsMap[tableId];

    // If seat already taken, skip
    if (currentTable[seatIndex] !== null) return false;

    for (let i = 0; i < currentTable.length; i++) {
      const otherStudent = currentTable[i];
      if (!otherStudent) continue;

      // Mutual blacklist checks
      if (blacklist.includes(otherStudent)) return false;
      if ((studentsData[otherStudent]?.blacklist || []).includes(student)) return false;
    }

    return true;
  }

  // --- Assignment function ---
  // Tries to place a list of students into any available valid seat
  function assignStudentsList(studentArr) {
    for (const student of studentArr) {
      let assigned = false;

      // Shuffle table and seat orders to prevent predictable patterns
      const shuffledTableIds = Object.keys(seatsMap);
      shuffleArray(shuffledTableIds);

      for (const tableId of shuffledTableIds) {
        const seatIndices = seatsMap[tableId].map((_, i) => i);
        shuffleArray(seatIndices);

        for (const seatIndex of seatIndices) {
          if (canSitAtSeat(student, tableId, seatIndex)) {
            seatsMap[tableId][seatIndex] = student;
            assigned = true;
            break;
          }
        }

        if (assigned) break;
      }

      // If no valid seat was found
      if (!assigned) {
        alert(`Random error try again.`);
      }
    }
  }

  // Step 4: Assign all students
  assignStudentsList(studentsWithBlacklist);      // Prioritize restrictions
  assignStudentsList(studentsWithoutBlacklist);   // Fill in the rest

  // Step 5: Apply all assignments to the DOM seats visually
  tables.forEach(table => {
    const tableId = table.dataset.id;
    const seatDivs = table.querySelectorAll('.seat');

    seatsMap[tableId].forEach((studentName, i) => {
      const seat = seatDivs[i];
      seat.dataset.studentName = studentName || '';

      if (studentName) {
        seat.textContent = studentName;  // Optional: use full name instead
        seat.title = studentName;
      } else {
        seat.textContent = '';
        seat.title = 'Click to assign student';
      }
    });
  });

  // Final: Update student list and persist to local storage
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
  addNameBtn.addEventListener('click', addStudent);

  studentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addStudent();
    }
  });

  addTableBtn.addEventListener('click', () => {
    createTable();
    saveTables();
  
  });

  // Add "Randomize Seating" button below existing buttons
  const randomizeBtn = document.createElement('button');
  randomizeBtn.textContent = 'Randomize Seating';
  randomizeBtn.id = 'randomizeSeatingBtn';
  addTableBtn.parentNode.insertBefore(randomizeBtn, addTableBtn.nextSibling);
  randomizeBtn.addEventListener('click', randomizeSeating);

  loadTables();
}

document.getElementById('bulk-add-btn').addEventListener('click', () => {
  const textarea = document.getElementById('bulk-add-textarea');
  const rawText = textarea.value.trim();
  if (!rawText) return alert('Please paste some student names first.');

  // Split by line breaks, trim, and filter out empty lines
  const newNames = rawText.split(/\r?\n/).map(name => name.trim()).filter(name => name.length > 0);

  let addedCount = 0;

  newNames.forEach(name => {
    if (!manualStudentNames.includes(name)) {
      manualStudentNames.push(name);
      // Initialize studentsData entry if missing
      if (!studentsData[name]) {
        studentsData[name] = { lockedSeat: null, blacklist: [] };
      }
      addedCount++;
    }
  });

  if (addedCount > 0) {
    alert(`Added ${addedCount} students.`);
    updateStudentList();
    saveTables();
  } else {
    alert('No new students to add.');
  }

  // Clear textarea after adding
  textarea.value = '';
});


window.addEventListener('DOMContentLoaded', init);
