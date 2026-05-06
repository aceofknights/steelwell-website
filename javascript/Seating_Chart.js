
const addTableBtn = document.getElementById('addTableBtn');
const studentList = document.getElementById('studentList');
const classroom = document.getElementById('classroom');
const seatColors = ['gray', 'pink', '#ff06ff', 'orange', 'blue', 'lightblue', 'yellow', 'green', 'purple', 'red'];
let dragData = null;
let resizeData = null;
let currentClass = 'default'; // default starting class
let classList = [];           // list of all classes (persisted)
let currentLayoutName = '';
let layoutMode = 'table';
let gridSettings = {
  rows: 5,
  columns: 6,
  rowGap: 8,
  columnGap: 8,
  aisles: [],
};
let studentGroups = [];
let useGroupAlternating = false;
console.log('INITIAL loadClassList():', localStorage.getItem('classList'));

// Each class’s data saved separately in localStorage, key = `seatingChartData_${className}`
function getStorageKey(className) {
  return `seatingChartData_${className}`;
}

function getLayoutStorageKey() {
  return 'tableLayouts';
}

function getCurrentLayoutStorageKey(className) {
  return `currentTableLayout_${className}`;
}

function saveCurrentClassData() {
  saveTables(); 
}

function generateGroupId() {
  return 'group-' + Math.random().toString(36).substr(2, 9);
}

function hasStudentGroups() {
  return studentGroups.length > 0;
}

function normalizeStudentGroups(groups = []) {
  return groups
    .filter(group => group && group.id && group.name)
    .map(group => ({ id: group.id, name: group.name }));
}

function getDefaultGroupId() {
  return studentGroups[0]?.id || '';
}

function ensureStudentRecord(name) {
  if (!studentsData[name]) {
    studentsData[name] = { lockedSeat: null, lockedTable: null, blacklist: [], present: true };
  }
  if (hasStudentGroups() && !studentsData[name].groupId) {
    studentsData[name].groupId = getDefaultGroupId();
  }
}

function createInitialStudentGroups() {
  if (hasStudentGroups()) return;

  const firstGroup = { id: generateGroupId(), name: 'Group 1' };
  const secondGroup = { id: generateGroupId(), name: 'Group 2' };
  studentGroups = [firstGroup, secondGroup];

  const existingNames = new Set([...manualStudentNames, ...Object.keys(studentsData)]);
  existingNames.forEach(name => {
    ensureStudentRecord(name);
    studentsData[name].groupId = firstGroup.id;
  });

  useGroupAlternating = true;
  updateStudentList();
  saveTables();
}

function addStudentGroup() {
  const groupName = prompt('Enter sublist name:', `Group ${studentGroups.length + 1}`);
  if (!groupName) return;

  const trimmedName = groupName.trim();
  if (!trimmedName) return;

  studentGroups.push({ id: generateGroupId(), name: trimmedName });
  updateStudentList();
  saveTables();
}

function renameStudentGroup(groupId) {
  const group = studentGroups.find(item => item.id === groupId);
  if (!group) return;

  const newName = prompt('Rename sublist:', group.name);
  if (!newName) return;

  const trimmedName = newName.trim();
  if (!trimmedName) return;

  group.name = trimmedName;
  updateStudentList();
  saveTables();
}

function deleteStudentGroup(groupId) {
  if (!hasStudentGroups()) return;
  const group = studentGroups.find(item => item.id === groupId);
  if (!group) return;

  if (!confirm(`Delete sublist "${group.name}"? Students in it will stay in the class.`)) {
    return;
  }

  studentGroups = studentGroups.filter(item => item.id !== groupId);

  if (studentGroups.length <= 1) {
    studentGroups = [];
    useGroupAlternating = false;
    Object.values(studentsData).forEach(data => {
      delete data.groupId;
    });
  } else {
    const fallbackGroupId = getDefaultGroupId();
    Object.values(studentsData).forEach(data => {
      if (data.groupId === groupId || !studentGroups.some(item => item.id === data.groupId)) {
        data.groupId = fallbackGroupId;
      }
    });
  }

  updateStudentList();
  saveTables();
}

function updateBulkGroupPicker() {
  bulkGroupRow.style.display = hasStudentGroups() ? 'flex' : 'none';
  bulkGroupSelect.innerHTML = '';

  studentGroups.forEach(group => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name;
    bulkGroupSelect.appendChild(option);
  });
}

function renderStudentGroupControls() {
  studentGroupControls.innerHTML = '';
  studentGroupControls.classList.add('student-group-controls');

  const heading = document.createElement('div');
  heading.classList.add('student-panel-heading');
  heading.textContent = 'Students';
  studentGroupControls.appendChild(heading);

  const actions = document.createElement('div');
  actions.classList.add('student-group-actions');

  const createGroupBtn = document.createElement('button');
  createGroupBtn.type = 'button';
  createGroupBtn.textContent = hasStudentGroups() ? '+ Sublist' : 'Create Sublists';
  createGroupBtn.addEventListener('click', () => {
    if (hasStudentGroups()) {
      addStudentGroup();
    } else {
      createInitialStudentGroups();
    }
  });
  actions.appendChild(createGroupBtn);

  if (hasStudentGroups()) {
    const alternateLabel = document.createElement('label');
    alternateLabel.classList.add('group-toggle-label');

    const alternateToggle = document.createElement('input');
    alternateToggle.type = 'checkbox';
    alternateToggle.checked = useGroupAlternating;
    alternateToggle.addEventListener('change', () => {
      useGroupAlternating = alternateToggle.checked;
      saveTables();
    });

    alternateLabel.appendChild(alternateToggle);
    alternateLabel.append(' Alternate random');
    actions.appendChild(alternateLabel);
  }

  studentGroupControls.appendChild(actions);

  if (hasStudentGroups()) {
    const groupList = document.createElement('div');
    groupList.classList.add('student-group-list');
    studentGroups.forEach(group => {
    const groupChip = document.createElement('button');
    groupChip.type = 'button';
    groupChip.classList.add('student-group-chip');
    groupChip.textContent = group.name;
    groupChip.title = 'Rename sublist';
    groupChip.addEventListener('click', () => renameStudentGroup(group.id));
    groupList.appendChild(groupChip);

      const deleteGroupBtn = document.createElement('button');
      deleteGroupBtn.type = 'button';
      deleteGroupBtn.classList.add('student-group-delete-btn');
      deleteGroupBtn.textContent = 'X';
      deleteGroupBtn.title = `Delete ${group.name}`;
      deleteGroupBtn.addEventListener('click', () => deleteStudentGroup(group.id));
      groupList.appendChild(deleteGroupBtn);
    });
    studentGroupControls.appendChild(groupList);
  }

  updateBulkGroupPicker();
}

function loadClassData(className) {
  const saved = localStorage.getItem(getStorageKey(className));
  if (!saved) {
    manualStudentNames = new Set();
    studentsData = {};
    studentGroups = [];
    useGroupAlternating = false;
    layoutMode = 'table';
    gridSettings = normalizeGridSettings();
    clearTables();
    syncModeControls();
    updateStudentList();
    refreshLayoutSelector();
    return;
  }
  const {
    tables = [],
    manualStudentNames: manualNames = [],
    studentsData: savedStudentsData = {},
    layoutMode: savedLayoutMode = 'table',
    gridSettings: savedGridSettings = {},
    gridSeats = [],
    studentGroups: savedStudentGroups = [],
    useGroupAlternating: savedUseGroupAlternating = false,
  } = JSON.parse(saved);
  manualStudentNames = new Set(manualNames);
  studentsData = savedStudentsData;
  studentGroups = normalizeStudentGroups(savedStudentGroups);
  useGroupAlternating = hasStudentGroups() && savedUseGroupAlternating;
  manualStudentNames.forEach(name => ensureStudentRecord(name));
  layoutMode = savedLayoutMode;
  gridSettings = normalizeGridSettings(savedGridSettings);
  clearTables();
  syncModeControls();
  if (isGridMode()) {
    createGrid(gridSeats);
  } else {
    tables.forEach(tableData => createTable(tableData));
  }
  updateStudentList();
  updateSeatsFromLocked(true);
  refreshLayoutSelector();
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
const layoutSelector = document.getElementById('layoutSelector');
const saveLayoutBtn = document.getElementById('saveLayoutBtn');
const addLayoutBtn = document.getElementById('addLayoutBtn');
const deleteLayoutBtn = document.getElementById('deleteLayoutBtn');
const layoutModeSelect = document.getElementById('layoutModeSelect');
const gridControls = document.getElementById('gridControls');
const gridRowsInput = document.getElementById('gridRowsInput');
const gridColumnsInput = document.getElementById('gridColumnsInput');
const gridRowGapInput = document.getElementById('gridRowGapInput');
const gridColumnGapInput = document.getElementById('gridColumnGapInput');
const studentGroupControls = document.getElementById('studentGroupControls');
const bulkGroupRow = document.getElementById('bulk-group-row');
const bulkGroupSelect = document.getElementById('bulkGroupSelect');

function loadLayouts() {
  const saved = localStorage.getItem(getLayoutStorageKey());
  return saved ? JSON.parse(saved) : {};
}

function saveLayouts(layouts) {
  localStorage.setItem(getLayoutStorageKey(), JSON.stringify(layouts));
}

function migrateClassLayoutsToSharedLibrary() {
  const sharedLayouts = loadLayouts();
  let changed = false;

  classList.forEach(className => {
    const oldKey = `tableLayouts_${className}`;
    const saved = localStorage.getItem(oldKey);
    if (!saved) return;

    const classLayouts = JSON.parse(saved);
    Object.entries(classLayouts).forEach(([name, layout]) => {
      let sharedName = name;
      if (sharedLayouts[sharedName]) {
        sharedName = `${name} (${className})`;
      }

      if (!sharedLayouts[sharedName]) {
        sharedLayouts[sharedName] = { ...layout, name: sharedName };
        changed = true;
      }
    });
  });

  if (changed) {
    saveLayouts(sharedLayouts);
  }
}

function getCurrentLayoutName(className = currentClass) {
  return localStorage.getItem(getCurrentLayoutStorageKey(className)) || '';
}

function saveCurrentLayoutName(layoutName, className = currentClass) {
  currentLayoutName = layoutName;
  if (layoutName) {
    localStorage.setItem(getCurrentLayoutStorageKey(className), layoutName);
  } else {
    localStorage.removeItem(getCurrentLayoutStorageKey(className));
  }
}

function normalizeGridSettings(settings = {}) {
  return {
    rows: Math.max(1, parseInt(settings.rows, 10) || 5),
    columns: Math.max(1, parseInt(settings.columns, 10) || 6),
    rowGap: Math.max(0, parseInt(settings.rowGap, 10) || 0),
    columnGap: Math.max(0, parseInt(settings.columnGap, 10) || 0),
    aisles: Array.isArray(settings.aisles) ? settings.aisles : [],
  };
}

function getGridSeatKey(row, column) {
  return `${row}-${column}`;
}

function isGridMode() {
  return layoutMode === 'grid';
}

function readGridSettingsFromInputs() {
  return normalizeGridSettings({
    rows: gridRowsInput.value,
    columns: gridColumnsInput.value,
    rowGap: gridRowGapInput.value,
    columnGap: gridColumnGapInput.value,
    aisles: gridSettings.aisles,
  });
}

function syncModeControls() {
  layoutModeSelect.value = layoutMode;
  gridControls.style.display = isGridMode() ? 'flex' : 'none';
  addTableBtn.style.display = isGridMode() ? 'none' : '';

  gridRowsInput.value = gridSettings.rows;
  gridColumnsInput.value = gridSettings.columns;
  gridRowGapInput.value = gridSettings.rowGap;
  gridColumnGapInput.value = gridSettings.columnGap;
}

function getCurrentTableLayout() {
  return Array.from(classroom.querySelectorAll('.table')).map(tableDiv => {
    const tableNameInput = tableDiv.querySelector('.table-name-input');
    return {
      id: tableDiv.dataset.id,
      seatCount: parseInt(tableDiv.querySelector('.seat-count').value, 10) || 1,
      columnCount: parseInt(tableDiv.querySelector('.column-count').value, 10) || 1,
      seatColor: tableDiv.querySelector('.seat-color').value,
      posX: parseInt(tableDiv.style.left, 10) || 20,
      posY: parseInt(tableDiv.style.top, 10) || 20,
      width: parseInt(tableDiv.style.width, 10) || tableDiv.offsetWidth,
      height: parseInt(tableDiv.style.height, 10) || tableDiv.offsetHeight,
      tableName: tableNameInput ? tableNameInput.value.trim() : '',
    };
  });
}

function getGridLayoutData() {
  const aisles = Array.from(classroom.querySelectorAll('.grid-seat.aisle')).map(seat => {
    return getGridSeatKey(seat.dataset.row, seat.dataset.column);
  });
  return normalizeGridSettings({ ...gridSettings, aisles });
}

function getCurrentGridSeatsData() {
  return Array.from(classroom.querySelectorAll('.grid-seat')).map(seat => ({
    row: parseInt(seat.dataset.row, 10),
    column: parseInt(seat.dataset.column, 10),
    isAisle: seat.dataset.seatType === 'aisle',
    studentName: seat.dataset.studentName || '',
  }));
}

function getCurrentLayoutData() {
  if (isGridMode()) {
    return {
      mode: 'grid',
      grid: getGridLayoutData(),
      tables: [],
    };
  }

  return {
    mode: 'table',
    tables: getCurrentTableLayout(),
  };
}

function applyTableLayout(layoutTables = []) {
  layoutMode = 'table';
  clearTables();
  layoutTables.forEach(tableData => createTable({ ...tableData, seats: [] }));
  syncModeControls();
  updateSeatsFromLocked(true);
  updateStudentList();
  saveTables();
}

function applySavedLayout(layoutData) {
  if (Array.isArray(layoutData)) {
    applyTableLayout(layoutData);
    return;
  }

  if (layoutData?.mode === 'grid') {
    layoutMode = 'grid';
    gridSettings = normalizeGridSettings(layoutData.grid);
    syncModeControls();
    createGrid();
    updateSeatsFromLocked(true);
    updateStudentList();
    saveTables();
    return;
  }

  applyTableLayout(layoutData?.tables || []);
}

function refreshLayoutSelector() {
  if (!layoutSelector || !currentClass) return;

  const layouts = loadLayouts();
  const names = Object.keys(layouts).sort((a, b) => a.localeCompare(b));
  const savedCurrent = getCurrentLayoutName();
  currentLayoutName = names.includes(savedCurrent) ? savedCurrent : '';

  layoutSelector.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = names.length ? 'Select saved layout' : 'No saved layouts';
  layoutSelector.appendChild(placeholder);

  names.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    layoutSelector.appendChild(option);
  });

  layoutSelector.value = currentLayoutName;
  saveLayoutBtn.disabled = !currentLayoutName;
  deleteLayoutBtn.disabled = !currentLayoutName;
}

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
  localStorage.removeItem(getCurrentLayoutStorageKey(currentClass));

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
    layoutSelector.innerHTML = '';
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

layoutSelector.addEventListener('change', () => {
  const layoutName = layoutSelector.value;
  if (!layoutName) {
    saveCurrentLayoutName('');
    refreshLayoutSelector();
    return;
  }

  const layouts = loadLayouts();
  if (!layouts[layoutName]) return;

  saveCurrentClassData();
  saveCurrentLayoutName(layoutName);
  applySavedLayout(layouts[layoutName]);
  refreshLayoutSelector();
});

saveLayoutBtn.addEventListener('click', () => {
  if (!currentLayoutName) {
    alert('Select a layout or create a new layout first.');
    return;
  }

  const layouts = loadLayouts();
  if (layouts[currentLayoutName] && !confirm(`Save over the existing layout "${currentLayoutName}"?`)) {
    return;
  }

  layouts[currentLayoutName] = {
    name: currentLayoutName,
    ...getCurrentLayoutData(),
  };
  saveLayouts(layouts);
  saveCurrentLayoutName(currentLayoutName);
  refreshLayoutSelector();
  alert(`Saved layout "${currentLayoutName}".`);
});

addLayoutBtn.addEventListener('click', () => {
  const layoutName = prompt('Enter new layout name:');
  if (!layoutName) return;

  const trimmedName = layoutName.trim();
  if (!trimmedName) return;

  const layouts = loadLayouts();
  if (layouts[trimmedName] && !confirm(`Replace the existing layout "${trimmedName}"?`)) {
    return;
  }

  layouts[trimmedName] = {
    name: trimmedName,
    ...getCurrentLayoutData(),
  };
  saveLayouts(layouts);
  saveCurrentLayoutName(trimmedName);
  refreshLayoutSelector();
  alert(`Saved layout "${trimmedName}".`);
});

deleteLayoutBtn.addEventListener('click', () => {
  if (!currentLayoutName) return;
  if (!confirm(`Delete the layout "${currentLayoutName}"? This will not delete students or tables currently on the chart.`)) {
    return;
  }

  const layouts = loadLayouts();
  delete layouts[currentLayoutName];
  saveLayouts(layouts);
  saveCurrentLayoutName('');
  refreshLayoutSelector();
});

layoutModeSelect.addEventListener('change', () => {
  const newMode = layoutModeSelect.value;
  if (newMode === layoutMode) return;

  if (!confirm(`Switch to ${newMode} mode? This changes the table layout view but keeps your student list.`)) {
    layoutModeSelect.value = layoutMode;
    return;
  }

  layoutMode = newMode;
  if (isGridMode()) {
    gridSettings = readGridSettingsFromInputs();
    createGrid(getCurrentGridSeatsData());
  } else {
    clearTables();
  }
  syncModeControls();
  updateStudentList();
  saveTables();
});

[gridRowsInput, gridColumnsInput, gridRowGapInput, gridColumnGapInput].forEach(input => {
  input.addEventListener('change', () => {
    if (!isGridMode()) return;
    const currentSeats = getCurrentGridSeatsData();
    gridSettings = readGridSettingsFromInputs();
    createGrid(currentSeats);
    updateSeatsFromLocked(true);
    updateStudentList();
    saveTables();
  });
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
    studentsData[name] = { lockedSeat: null, blacklist: [], present: true };
  }
  ensureStudentRecord(name);
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
    ensureStudentRecord(name);
  });

  renderStudentGroupControls();
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
      studentGroups = [];
      useGroupAlternating = false;
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
  const groupStudentLists = new Map();

  if (hasStudentGroups()) {
    studentGroups.forEach(group => {
      const groupCount = namesArray.filter(name => getStudentGroupId(name) === group.id).length;
      const groupSection = document.createElement('li');
      groupSection.classList.add('student-sublist-section');

      const groupDetails = document.createElement('details');
      groupDetails.classList.add('student-sublist-details');
      groupDetails.open = true;

      const groupSummary = document.createElement('summary');
      groupSummary.classList.add('student-sublist-summary');

      const groupTitle = document.createElement('span');
      groupTitle.textContent = group.name;
      groupSummary.appendChild(groupTitle);

      const groupCountBadge = document.createElement('span');
      groupCountBadge.classList.add('student-sublist-count');
      groupCountBadge.textContent = `${groupCount}`;
      groupSummary.appendChild(groupCountBadge);

      const deleteGroupBtn = document.createElement('button');
      deleteGroupBtn.type = 'button';
      deleteGroupBtn.classList.add('student-sublist-delete-btn');
      deleteGroupBtn.textContent = 'X';
      deleteGroupBtn.title = `Delete ${group.name}`;
      deleteGroupBtn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        deleteStudentGroup(group.id);
      });
      groupSummary.appendChild(deleteGroupBtn);

      const groupItems = document.createElement('ul');
      groupItems.classList.add('student-sublist-items');

      groupDetails.appendChild(groupSummary);
      groupDetails.appendChild(groupItems);
      groupSection.appendChild(groupDetails);
      studentList.appendChild(groupSection);
      groupStudentLists.set(group.id, groupItems);
    });
  }
  
  
  namesArray.forEach(name => {
  const li = document.createElement('li');
  li.classList.add('student-list-item');
  li.dataset.student = name;

  const nameSpan = document.createElement('span');
  nameSpan.classList.add('student-name');
  nameSpan.textContent = name;
  li.appendChild(nameSpan);

  if (hasStudentGroups()) {
    const groupSelect = document.createElement('select');
    groupSelect.classList.add('student-group-select');
    groupSelect.title = 'Sublist';
    studentGroups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      groupSelect.appendChild(option);
    });
    groupSelect.value = studentsData[name]?.groupId || getDefaultGroupId();
    groupSelect.addEventListener('change', () => {
      ensureStudentRecord(name);
      studentsData[name].groupId = groupSelect.value;
      saveTables();
      updateStudentList();
    });
    li.appendChild(groupSelect);
  }

  const buttonGroup = document.createElement('div');
  buttonGroup.classList.add('student-button-group');

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
          setSeatStudent(seat, '');
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
  if (isGridMode()) {
    tableRadio.lab.style.display = 'none';
    seatRadio.lab.lastChild.textContent = ' Lock to Grid Seat';
  }

  lockTypeWrapper.appendChild(noneRadio.lab);
  lockTypeWrapper.appendChild(tableRadio.lab);
  lockTypeWrapper.appendChild(seatRadio.lab);
  optionsPanel.appendChild(lockTypeWrapper);

  // --- Table & Seat selects ---
  const seatAssignmentContainer = document.createElement('div');
  seatAssignmentContainer.classList.add('seat-assignment');

  const tableAssignLabel = document.createElement('label');
  tableAssignLabel.textContent = isGridMode() ? 'Row: ' : 'Assign Table: ';
  const tableAssignSelect = document.createElement('select');
  tableAssignSelect.classList.add('assign-table');
  tableAssignLabel.appendChild(tableAssignSelect);

  const seatAssignLabel = document.createElement('label');
  seatAssignLabel.textContent = isGridMode() ? 'Column: ' : 'Assign Seat: ';
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
    seatAssignLabel.style.display = (val === 'seat' || (isGridMode() && val !== 'none')) ? 'block' : 'none';
  }

  // --- Blacklist Section ---
  const blacklistDetails = document.createElement('details');
  blacklistDetails.classList.add('blacklist-details');
  const blacklistSummary = document.createElement('summary');
  blacklistSummary.textContent = 'Blacklist Students';
  blacklistDetails.appendChild(blacklistSummary);
  const blacklistFieldset = document.createElement('fieldset');
  blacklistDetails.appendChild(blacklistFieldset);
  optionsPanel.appendChild(blacklistDetails);

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
  const targetStudentList = hasStudentGroups()
    ? groupStudentLists.get(getStudentGroupId(name)) || groupStudentLists.get(getDefaultGroupId()) || studentList
    : studentList;
  targetStudentList.appendChild(li);

  // === Helpers ===
  function refreshTableOptions() {
    tableAssignSelect.innerHTML = '';
    if (isGridMode()) {
      for (let row = 1; row <= gridSettings.rows; row++) {
        const option = document.createElement('option');
        option.value = row;
        option.textContent = `Row ${row}`;
        tableAssignSelect.appendChild(option);
      }
      refreshSeatOptions();
      return;
    }

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
    if (isGridMode()) {
      const row = parseInt(tableAssignSelect.value, 10);
      if (!row) return;

      for (let column = 1; column <= gridSettings.columns; column++) {
        const seat = classroom.querySelector(`.grid-seat[data-row="${row}"][data-column="${column}"]`);
        if (!seat || seat.dataset.seatType === 'aisle') continue;

        const lockedByOther = Object.entries(studentsData).some(([otherName, data]) => {
          return otherName !== name &&
                 data.lockedSeat &&
                 data.lockedSeat.mode === 'grid' &&
                 data.lockedSeat.row === row &&
                 data.lockedSeat.column === column;
        });

        if (!lockedByOther) {
          const option = document.createElement('option');
          option.value = column;
          option.textContent = `Column ${column}`;
          seatAssignSelect.appendChild(option);
        }
      }
      return;
    }

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
    const others = namesArray.filter(n => n !== name);
    others.forEach(other => {
      const wrapper = document.createElement('label');
      wrapper.classList.add('blacklist-option');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = other;
      checkbox.id = `blacklist-${name}-${other}`;
      checkbox.checked = studentsData[name]?.blacklist?.includes(other);

      wrapper.appendChild(checkbox);
      wrapper.append(` ${other}`);
      blacklistFieldset.appendChild(wrapper);
    });
  }

  // === Events ===
  optionsBtn.addEventListener('click', () => {
    if (optionsPanel.style.display === 'none') {
      refreshTableOptions();
      refreshBlacklistOptions();

      const sData = studentsData[name] || {};
      if (isGridMode() && sData.lockedSeat?.mode === 'grid') {
        seatRadio.r.checked = true;
        tableAssignSelect.value = String(sData.lockedSeat.row || '');
        refreshSeatOptions();
        seatAssignSelect.value = String(sData.lockedSeat.column || '');
      } else if (!isGridMode() && sData.lockedSeat) {
        seatRadio.r.checked = true;
        tableAssignSelect.value = sData.lockedSeat.tableId || '';
        refreshSeatOptions();
        seatAssignSelect.value = String(sData.lockedSeat.seatIndex);
      } else if (!isGridMode() && sData.lockedTable) {
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

    if (isGridMode() && lockVal === 'table') {
      alert('Grid mode only supports locking to a specific row and column.');
      return;
    }
    if ((lockVal === 'table' || lockVal === 'seat') && !tableAssignSelect.value) {
      alert(isGridMode() ? 'Please select a row.' : 'Please select a table.');
      return;
    }
    if (lockVal === 'seat' && !seatAssignSelect.value) {
      alert(isGridMode() ? 'Please select a column.' : 'Please select a seat.');
      return;
    }

    if (!studentsData[name]) {
      studentsData[name] = { lockedSeat: null, lockedTable: null, blacklist: [], present: true };
    }

    if (isGridMode() && lockVal === 'seat') {
      studentsData[name].lockedSeat = {
        mode: 'grid',
        row: parseInt(tableAssignSelect.value, 10),
        column: parseInt(seatAssignSelect.value, 10)
      };
      studentsData[name].lockedTable = null;
    } else if (lockVal === 'seat') {
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
    setSeatStudent(seat, '', suppressVisual);
  });

  if (isGridMode()) {
    Object.entries(studentsData).forEach(([student, data]) => {
      if (!data.lockedSeat || data.lockedSeat.mode !== 'grid') return;
      const { row, column } = data.lockedSeat;
      const seat = classroom.querySelector(`.grid-seat[data-row="${row}"][data-column="${column}"]`);
      if (!seat || seat.dataset.seatType === 'aisle') return;
      setSeatStudent(seat, student, suppressVisual);
    });
    return;
  }

  // --- STEP 1: Exact seat locks ---
  Object.entries(studentsData).forEach(([student, data]) => {
    if (data.lockedSeat && data.lockedSeat.mode !== 'grid') {
      const { tableId, seatIndex } = data.lockedSeat;
      const table = classroom.querySelector(`.table[data-id="${tableId}"]`);
      if (!table) return;
      const seat = table.querySelectorAll('.seat')[seatIndex];
      if (!seat) return;

      setSeatStudent(seat, student, suppressVisual);
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
        setSeatStudent(freeSeat, student, suppressVisual);
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
    const columnCount = parseInt(tableDiv.querySelector('.column-count').value, 10) || 1;
    const seatColor = tableDiv.querySelector('.seat-color').value;
    const posX = parseInt(tableDiv.style.left, 10) || 20;
    const posY = parseInt(tableDiv.style.top, 10) || 20;
    const width = parseInt(tableDiv.style.width, 10) || tableDiv.offsetWidth;
    const height = parseInt(tableDiv.style.height, 10) || tableDiv.offsetHeight;

    const seats = [];
    tableDiv.querySelectorAll('.seat').forEach(seat => {
      seats.push(seat.dataset.studentName || '');
    });

    const tableNameInput = tableDiv.querySelector('.table-name-input');
    const tableName = tableNameInput ? tableNameInput.value.trim() : '';

    tables.push({
      id,
      seatCount,
      columnCount,
      seatColor,
      posX,
      posY,
      width,
      height,
      seats,
      tableName,
    });
  });

  const savedGridSettings = isGridMode() ? getGridLayoutData() : gridSettings;
  const gridSeats = getCurrentGridSeatsData();

  const saveObj = {
    tables,
    layoutMode,
    gridSettings: savedGridSettings,
    gridSeats,
    studentGroups,
    useGroupAlternating,
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

function fitGridSeatName(seat) {
  const label = seat.querySelector('.grid-seat-name');
  if (!label || seat.dataset.seatType === 'aisle' || !label.textContent.trim()) return;

  const maxWidth = Math.max(1, seat.clientWidth - 14);
  const maxHeight = Math.max(1, seat.clientHeight - 14);
  let low = 4;
  let high = 80;
  let best = low;

  label.style.fontSize = `${low}px`;
  label.style.width = `${maxWidth}px`;
  label.style.whiteSpace = 'normal';
  label.style.overflowWrap = 'anywhere';

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    label.style.fontSize = `${mid}px`;

    if (label.scrollWidth <= maxWidth && label.scrollHeight <= maxHeight) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  label.style.fontSize = `${best}px`;
}

function fitAllGridSeatNames() {
  classroom.querySelectorAll('.grid-seat').forEach(fitGridSeatName);
}

function setSeatStudent(seat, studentName, suppressVisual = false) {
  const name = studentName || '';
  seat.dataset.studentName = name;

  if (seat.classList.contains('grid-seat')) {
    const label = seat.querySelector('.grid-seat-name');
    if (seat.dataset.seatType === 'aisle') {
      seat.dataset.studentName = '';
      if (label) label.textContent = 'Aisle';
      seat.title = 'Aisle';
      return;
    }

    if (label) label.textContent = suppressVisual ? '' : name;
    seat.title = name || 'Click to assign student';
    requestAnimationFrame(() => fitGridSeatName(seat));
    return;
  }

  seat.textContent = suppressVisual ? '' : name;
  seat.title = name || 'Click to assign student';
}

function createGrid(savedGridSeats = []) {
  clearTables();
  const savedByKey = new Map(savedGridSeats.map(seat => [getGridSeatKey(seat.row, seat.column), seat]));
  const aisleSet = new Set(gridSettings.aisles);

  const gridDiv = document.createElement('div');
  gridDiv.classList.add('seating-grid');
  gridDiv.style.gridTemplateColumns = `repeat(${gridSettings.columns}, minmax(54px, 1fr))`;
  gridDiv.style.gap = `${gridSettings.rowGap}px ${gridSettings.columnGap}px`;

  for (let row = 1; row <= gridSettings.rows; row++) {
    for (let column = 1; column <= gridSettings.columns; column++) {
      const key = getGridSeatKey(row, column);
      const savedSeat = savedByKey.get(key);
      const seat = document.createElement('div');
      seat.classList.add('seat', 'grid-seat');
      seat.dataset.row = row;
      seat.dataset.column = column;
      seat.dataset.seatIndex = key;
      seat.dataset.seatType = savedSeat?.isAisle || aisleSet.has(key) ? 'aisle' : 'regular';
      if (seat.dataset.seatType === 'aisle') seat.classList.add('aisle');

      const label = document.createElement('span');
      label.classList.add('grid-seat-name');
      seat.appendChild(label);

      const aisleBtn = document.createElement('button');
      aisleBtn.type = 'button';
      aisleBtn.classList.add('aisle-toggle-btn');
      aisleBtn.title = 'Toggle aisle';
      aisleBtn.textContent = 'A';
      seat.appendChild(aisleBtn);

      aisleBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isAisle = seat.dataset.seatType === 'aisle';
        seat.dataset.seatType = isAisle ? 'regular' : 'aisle';
        seat.classList.toggle('aisle', !isAisle);
        if (!isAisle) {
          setSeatStudent(seat, '');
        } else {
          setSeatStudent(seat, seat.dataset.studentName || '');
        }
        gridSettings = getGridLayoutData();
        saveTables();
      });

      seat.addEventListener('click', () => {
        if (seat.dataset.seatType === 'aisle') return;

        const newName = prompt('Enter student name for this seat:', seat.dataset.studentName);
        if (newName === null) return;

        const trimmed = newName.trim();
        if (trimmed && !manualStudentNames.has(trimmed)) {
          manualStudentNames.add(trimmed);
          if (!studentsData[trimmed]) studentsData[trimmed] = { lockedSeat: null, blacklist: [] };
          updateStudentList();
        }

        const lockedByOptions = Object.entries(studentsData).some(([, sData]) => {
          return sData.lockedSeat &&
                 sData.lockedSeat.mode === 'grid' &&
                 sData.lockedSeat.row === row &&
                 sData.lockedSeat.column === column;
        });

        if (lockedByOptions) {
          alert('This seat is locked via options. Please use the options panel to change assignment.');
          return;
        }

        setSeatStudent(seat, trimmed);
        updateStudentList();
        saveTables();
      });

      setSeatStudent(seat, savedSeat?.studentName || '');
      gridDiv.appendChild(seat);
    }
  }

  classroom.appendChild(gridDiv);
  requestAnimationFrame(fitAllGridSeatNames);
}


// --- Generate unique ID ---
function generateId() {
  return 'table-' + Math.random().toString(36).substr(2, 9);
}

function updateTableScale(tableDiv) {
  const width = parseInt(tableDiv.style.width, 10) || tableDiv.offsetWidth || 360;
  const height = parseInt(tableDiv.style.height, 10) || tableDiv.offsetHeight || 400;
  const scale = Math.max(0.65, Math.min(width / 360, height / 400));
  tableDiv.style.setProperty('--table-scale', scale.toFixed(2));
}

function updateSeatGrid(tableDiv, count) {
  const seatsDiv = tableDiv.querySelector('.seats');
  if (!seatsDiv || count <= 0) return;

  const seatsRect = seatsDiv.getBoundingClientRect();
  const columnInput = tableDiv.querySelector('.column-count');
  const columnCount = Math.max(1, parseInt(columnInput?.value, 10) || 1);
  const rows = Math.ceil(count / columnCount);
  const cellWidth = seatsRect.width / columnCount;
  const cellHeight = seatsRect.height / rows;

  const seatFontSize = Math.max(12, Math.min(80, cellHeight * 0.42, cellWidth * 0.18));
  seatsDiv.style.setProperty('--seat-columns', columnCount);
  seatsDiv.style.setProperty('--seat-font-size', seatFontSize + 'px');
}

// --- Create a table and append to classroom ---
function createTable(data = {}) {
  const tableDiv = document.createElement('div');
  tableDiv.classList.add('table');
  tableDiv.dataset.id = data.id || generateId();

  // Position or default
  tableDiv.style.left = (data.posX || 20) + 'px';
  tableDiv.style.top = (data.posY || 20) + 'px';
  tableDiv.style.width = (data.width || 360) + 'px';
  tableDiv.style.height = (data.height || 400) + 'px';
  updateTableScale(tableDiv);

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

  // Column count input
  const columnCountInput = document.createElement('input');
  columnCountInput.type = 'number';
  columnCountInput.classList.add('column-count');
  columnCountInput.min = '1';
  columnCountInput.step = '1';
  columnCountInput.value = data.columnCount || 1;
  columnCountInput.title = 'Columns';
  columnCountInput.setAttribute('aria-label', 'Columns');
  controlsDiv.appendChild(columnCountInput);

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

  const resizeHandle = document.createElement('div');
  resizeHandle.classList.add('table-resize-handle');
  resizeHandle.title = 'Drag to resize table';
  tableDiv.appendChild(resizeHandle);

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

    updateSeatGrid(tableDiv, count);
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

  columnCountInput.addEventListener('input', () => {
    const value = Math.max(1, parseInt(columnCountInput.value, 10) || 1);
    columnCountInput.value = value;
    updateSeatGrid(tableDiv, parseInt(seatCountSelect.value, 10) || 1);
    saveTables();
  });

  colorSelect.addEventListener('change', () => {
    renderSeats();
    saveTables();
  });

  tableNameInput.addEventListener('input', () => {
    saveTables();
    updateStudentList();
  });

  resizeHandle.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();

    resizeData = {
      elem: tableDiv,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: tableDiv.offsetWidth,
      startHeight: tableDiv.offsetHeight,
    };
    tableDiv.classList.add('resizing');
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
    if (resizeData || e.target.closest('.table-resize-handle')) return;
    if (['SELECT', 'BUTTON', 'INPUT', 'LABEL'].includes(e.target.tagName)) return;

    dragData = {
      elem: tableDiv,
      offsetX: e.clientX - tableDiv.getBoundingClientRect().left,
      offsetY: e.clientY - tableDiv.getBoundingClientRect().top,
    };
    tableDiv.style.cursor = 'grabbing';
  });

  return tableDiv;
}

document.addEventListener('mousemove', e => {
  if (resizeData) {
    const parentRect = classroom.getBoundingClientRect();
    const maxWidth = Math.max(220, parentRect.width - resizeData.elem.offsetLeft);
    const maxHeight = Math.max(220, parentRect.height - resizeData.elem.offsetTop);
    const newWidth = Math.min(Math.max(220, resizeData.startWidth + e.clientX - resizeData.startX), maxWidth);
    const newHeight = Math.min(Math.max(220, resizeData.startHeight + e.clientY - resizeData.startY), maxHeight);

    resizeData.elem.style.width = newWidth + 'px';
    resizeData.elem.style.height = newHeight + 'px';
    updateTableScale(resizeData.elem);
    updateSeatGrid(resizeData.elem, parseInt(resizeData.elem.querySelector('.seat-count').value, 10) || 1);
    return;
  }

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
  if (resizeData) {
    resizeData.elem.classList.remove('resizing');
    resizeData = null;
    saveTables();
  }

  if (dragData) {
    dragData.elem.style.cursor = 'grab';
    dragData = null;
    saveTables();
  }
});

function getStudentGroupId(student) {
  const groupId = studentsData[student]?.groupId;
  if (studentGroups.some(group => group.id === groupId)) return groupId;
  return getDefaultGroupId();
}

function buildAlternatingStudentPool(students) {
  if (!hasStudentGroups() || !useGroupAlternating) return [...students];

  const grouped = studentGroups.map(group => {
    const names = students.filter(student => getStudentGroupId(student) === group.id);
    shuffleArray(names);
    return names;
  });
  const ordered = [];
  let groupIndex = 0;

  while (grouped.some(group => group.length > 0)) {
    const group = grouped[groupIndex % grouped.length];
    if (group.length) {
      ordered.push(group.shift());
    }
    groupIndex++;
  }

  return ordered;
}

function canSitWithTableBlacklist(student, tableId, seatIndex, seatsMap) {
  const row = seatsMap[tableId];
  if (!row || row[seatIndex] !== null) return false;

  const data = studentsData[student] || {};
  if (data.lockedTable && data.lockedTable !== tableId) return false;
  if (data.lockedSeat && data.lockedSeat.mode !== 'grid') {
    if (data.lockedSeat.tableId !== tableId || data.lockedSeat.seatIndex !== seatIndex) return false;
  }

  const blacklist = data.blacklist || [];
  return row.every(other => {
    return !other ||
           (!blacklist.includes(other) &&
            !(studentsData[other]?.blacklist || []).includes(student));
  });
}

function randomizeTableByGroups() {
  const presentStudents = Array.from(manualStudentNames).filter(
    name => studentsData[name]?.present !== false
  );
  const pool = buildAlternatingStudentPool(presentStudents);
  const tables = Array.from(classroom.querySelectorAll('.table')).sort((a, b) => {
    const topDiff = (parseInt(a.style.top, 10) || 0) - (parseInt(b.style.top, 10) || 0);
    if (topDiff !== 0) return topDiff;
    return (parseInt(a.style.left, 10) || 0) - (parseInt(b.style.left, 10) || 0);
  });
  const seatsMap = {};
  const orderedSeats = [];

  tables.forEach(table => {
    const count = parseInt(table.querySelector('.seat-count').value, 10) || 0;
    seatsMap[table.dataset.id] = new Array(count).fill(null);
    for (let seatIndex = 0; seatIndex < count; seatIndex++) {
      orderedSeats.push({ tableId: table.dataset.id, seatIndex });
    }
  });

  if (orderedSeats.length < pool.length) {
    alert(`Not enough seats! You have ${pool.length} present students but only ${orderedSeats.length} seats.`);
    return true;
  }

  function removeFromPool(student) {
    const idx = pool.indexOf(student);
    if (idx !== -1) pool.splice(idx, 1);
  }

  Object.entries(studentsData).forEach(([student, data]) => {
    if (!data?.lockedSeat || data.lockedSeat.mode === 'grid') return;
    if (!pool.includes(student)) return;
    const { tableId, seatIndex } = data.lockedSeat;
    if (canSitWithTableBlacklist(student, tableId, seatIndex, seatsMap)) {
      seatsMap[tableId][seatIndex] = student;
      removeFromPool(student);
    }
  });

  for (const student of [...pool]) {
    const spot = orderedSeats.find(({ tableId, seatIndex }) => {
      return canSitWithTableBlacklist(student, tableId, seatIndex, seatsMap);
    });

    if (spot) {
      seatsMap[spot.tableId][spot.seatIndex] = student;
      removeFromPool(student);
    }
  }

  tables.forEach(table => {
    const tableId = table.dataset.id;
    table.querySelectorAll('.seat').forEach((seat, index) => {
      setSeatStudent(seat, seatsMap[tableId][index] || '');
    });
  });

  if (pool.length) {
    alert(`Could not place ${pool.length} student(s). Constraints may be impossible.`);
  }

  updateStudentList();
  saveTables();
  return true;
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
function randomizeGridSeating() {
  const pool = Array.from(manualStudentNames).filter(
    name => studentsData[name]?.present !== false
  );
  const orderedPool = useGroupAlternating ? buildAlternatingStudentPool(pool) : [...pool];
  const seats = Array.from(classroom.querySelectorAll('.grid-seat'))
    .filter(seat => seat.dataset.seatType !== 'aisle');

  if (seats.length < orderedPool.length) {
    alert(`Not enough seats! You have ${orderedPool.length} present students but only ${seats.length} regular grid seats.`);
    return;
  }

  const seatsMap = {};
  seats.forEach(seat => {
    seatsMap[getGridSeatKey(seat.dataset.row, seat.dataset.column)] = null;
  });

  function removeFromPool(student) {
    const poolIdx = pool.indexOf(student);
    const orderedIdx = orderedPool.indexOf(student);
    if (poolIdx !== -1) pool.splice(poolIdx, 1);
    if (orderedIdx !== -1) orderedPool.splice(orderedIdx, 1);
  }

  function getNeighborNames(row, column, map) {
    const neighborKeys = [
      getGridSeatKey(row - 1, column),
      getGridSeatKey(row + 1, column),
      getGridSeatKey(row, column - 1),
      getGridSeatKey(row, column + 1),
    ];
    return neighborKeys.map(key => map[key]).filter(Boolean);
  }

  function canSitAtGridSeat(student, row, column, map) {
    const key = getGridSeatKey(row, column);
    if (!(key in map) || map[key] !== null) return false;

    const data = studentsData[student] || {};
    if (data.lockedSeat?.mode === 'grid') {
      if (data.lockedSeat.row !== row ||
          data.lockedSeat.column !== column) {
        return false;
      }
    }

    const blacklist = data.blacklist || [];
    return getNeighborNames(row, column, map).every(other => {
      return !blacklist.includes(other) &&
             !(studentsData[other]?.blacklist || []).includes(student);
    });
  }

  Object.entries(studentsData).forEach(([student, data]) => {
    if (!data?.lockedSeat || data.lockedSeat.mode !== 'grid') return;
    if (!orderedPool.includes(student)) return;
    const { row, column } = data.lockedSeat;
    const key = getGridSeatKey(row, column);

    if (canSitAtGridSeat(student, row, column, seatsMap)) {
      seatsMap[key] = student;
      removeFromPool(student);
    } else {
      console.warn(`Locked grid seat invalid/taken for ${student} (row=${row}, column=${column}).`);
    }
  });

  const remaining = useGroupAlternating
    ? [...orderedPool]
    : [...orderedPool].sort((a, b) => {
        return (studentsData[b]?.blacklist?.length || 0) - (studentsData[a]?.blacklist?.length || 0);
      });

  remaining.forEach(student => {
    const candidates = Object.keys(seatsMap)
      .filter(key => seatsMap[key] === null)
      .map(key => {
        const [row, column] = key.split('-').map(Number);
        return { key, row, column };
      });
    if (!useGroupAlternating) shuffleArray(candidates);

    const spot = candidates.find(candidate => canSitAtGridSeat(student, candidate.row, candidate.column, seatsMap));
    if (spot) {
      seatsMap[spot.key] = student;
      removeFromPool(student);
    } else {
      console.warn(`Could not place ${student} in grid mode. Constraints may be impossible.`);
    }
  });

  classroom.querySelectorAll('.grid-seat').forEach(seat => {
    const key = getGridSeatKey(seat.dataset.row, seat.dataset.column);
    setSeatStudent(seat, seatsMap[key] || '');
  });

  if (orderedPool.length) {
    alert(`Could not place ${orderedPool.length} student(s). Constraints may be impossible.`);
  }

  updateStudentList();
  saveTables();
}

function randomizeSeating() {
  if (isGridMode()) {
    randomizeGridSeating();
    return;
  }

  if (hasStudentGroups() && useGroupAlternating) {
    randomizeTableByGroups();
    return;
  }

  // ---------- Step 0: gather present students ----------
  const pool = Array.from(manualStudentNames).filter(
    name => studentsData[name]?.present !== false
  );

  const tables = Array.from(classroom.querySelectorAll('.table'));
  const totalSeats = tables.reduce((sum, table) => {
    const count = parseInt(table.querySelector('.seat-count').value, 10) || 0;
    return sum + count;
  }, 0);

  if (totalSeats < pool.length) {
    alert(`Not enough seats! You have ${pool.length} present students but only ${totalSeats} seats.`);
    return;
  }

  // seatsMap: { tableId: [null, null, ...] }
  const seatsMap = {};
  tables.forEach(table => {
    const count = parseInt(table.querySelector('.seat-count').value, 10) || 0;
    seatsMap[table.dataset.id] = new Array(count).fill(null);
  });

  // ---------- helpers ----------
  function removeFromPool(student) {
    const idx = pool.indexOf(student);
    if (idx !== -1) pool.splice(idx, 1);
  }

  function findStudentLocation(map, student) {
    for (const tId in map) {
      const idx = map[tId].indexOf(student);
      if (idx !== -1) return { tableId: tId, seatIndex: idx };
    }
    return null;
  }

  function isStudentSeated(student) {
    return !!findStudentLocation(seatsMap, student);
  }

  // check with seat truly empty
  function canSitAtSeat(student, tableId, seatIndex, currentSeatsMap) {
    const data = studentsData[student] || {};
    const blacklist = data.blacklist || [];
    const row = currentSeatsMap[tableId];
    if (!row || row[seatIndex] !== null) return false;

    if (data.lockedTable && tableId !== data.lockedTable) return false;

    if (data.lockedSeat && data.lockedSeat.mode !== 'grid') {
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

  // like canSitAtSeat, but allows taking an OCCUPIED seat as long as the occupant will move
  function canSitIgnoringOccupant(student, tableId, seatIndex, currentSeatsMap) {
    const data = studentsData[student] || {};
    const row = currentSeatsMap[tableId];
    if (!row) return false;

    if (data.lockedTable && tableId !== data.lockedTable) return false;
    if (data.lockedSeat && data.lockedSeat.mode !== 'grid') {
      if (data.lockedSeat.tableId !== tableId || data.lockedSeat.seatIndex !== seatIndex) return false;
    }

    for (let i = 0; i < row.length; i++) {
      if (i === seatIndex) continue; // pretend this seat is empty (occupant will move)
      const other = row[i];
      if (!other) continue;
      const blacklist = data.blacklist || [];
      if (blacklist.includes(other)) return false;
      if ((studentsData[other]?.blacklist || []).includes(student)) return false;
    }
    return true;
  }

  // heuristic score: exact seat > table lock > many blacklists
  function constraintScore(name) {
    const d = studentsData[name] || {};
    let s = 0;
    if (d.lockedSeat && d.lockedSeat.mode !== 'grid') s += 1000;
    else if (d.lockedTable) s += 200;
    s += (d.blacklist?.length || 0);
    return -s; // more negative = harder
  }

  // ---------- STEP 1: place exact-seat locks first ----------
  Object.entries(studentsData).forEach(([student, data]) => {
    if (!data?.lockedSeat || data.lockedSeat.mode === 'grid') return;
    if (!pool.includes(student)) return; // absent
    const { tableId, seatIndex } = data.lockedSeat;
    if (seatsMap[tableId] && seatIndex >= 0 && seatIndex < seatsMap[tableId].length && seatsMap[tableId][seatIndex] === null) {
      seatsMap[tableId][seatIndex] = student;
      removeFromPool(student);
    } else {
      console.warn(`Locked seat invalid/taken for ${student} (table=${tableId}, seat=${seatIndex}).`);
    }
  });

  // ---------- STEP 2: greedy place table-locks (any valid free seat at that table) ----------
  const tableLocked = pool.filter(s => {
    const d = studentsData[s];
    return d?.lockedTable && !d?.lockedSeat;
  });

  // randomize a bit for variety
  shuffleArray(tableLocked);

  tableLocked.forEach(student => {
    const tableId = studentsData[student].lockedTable;
    const row = seatsMap[tableId];
    if (!row) {
      console.warn(`Locked table for ${student} does not exist: ${tableId}`);
      return;
    }
    const empties = row.map((v, i) => (v === null ? i : -1)).filter(i => i !== -1);
    shuffleArray(empties);
    for (const seatIndex of empties) {
      if (canSitAtSeat(student, tableId, seatIndex, seatsMap)) {
        row[seatIndex] = student;
        removeFromPool(student);
        return;
      }
    }
    console.warn(`No valid seat found on locked table for ${student} (${tableId}); will try later.`);
  });

  // ---------- STEP 3: greedy place the rest (respecting locks via canSitAtSeat) ----------
  const withBlacklist = pool.filter(s => (studentsData[s]?.blacklist || []).length > 0);
  const withoutBlacklist = pool.filter(s => !(studentsData[s]?.blacklist || []).length);

  shuffleArray(withBlacklist);
  shuffleArray(withoutBlacklist);

  function assignStudentsList(studentArr) {
    for (const student of [...studentArr]) {
      let assigned = false;
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
            removeFromPool(student);     // IMPORTANT: keep pool = unseated only
            assigned = true;
            break;
          }
        }
        if (assigned) break;
      }
      if (!assigned) {
        // leave in pool for swap-based placement
        // console.debug(`Greedy could not place ${student}; will try swaps.`);
      }
    }
  }

  assignStudentsList(withBlacklist);
  assignStudentsList(withoutBlacklist);

  // ---------- STEP 3.5: safety de-duplication (just in case) ----------
  // If any student accidentally appears twice (shouldn't now), remove extras and push back to pool.
  (function dedupeSeats() {
    const seen = new Set();
    for (const tId in seatsMap) {
      const row = seatsMap[tId];
      for (let i = 0; i < row.length; i++) {
        const name = row[i];
        if (!name) continue;
        if (seen.has(name)) {
          row[i] = null;
          if (!pool.includes(name)) pool.push(name);
        } else {
          seen.add(name);
        }
      }
    }
    // ensure pool = present - seen
    const present = Array.from(manualStudentNames).filter(n => studentsData[n]?.present !== false);
    const seated = seen;
    const correctedPool = present.filter(n => !seated.has(n));
    pool.length = 0;
    pool.push(...correctedPool);
  })();

  // ---------- STEP 4: swap-capable placement for leftovers ----------
  function tryPlace(student, visited = new Set()) {
    if (isStudentSeated(student)) return true;         // already seated
    if (visited.has(student)) return false;            // avoid cycles
    visited.add(student);

    const d = studentsData[student] || {};
    const tableIds = d.lockedSeat && d.lockedSeat.mode !== 'grid'
      ? [d.lockedSeat.tableId]
      : d.lockedTable
      ? [d.lockedTable]
      : Object.keys(seatsMap);

    const emptyOptions = [];
    const swapOptions = [];

    for (const tableId of tableIds) {
      const row = seatsMap[tableId];
      if (!row) continue;

      for (let seatIndex = 0; seatIndex < row.length; seatIndex++) {
        const occupant = row[seatIndex];

        if (occupant === null) {
          if (canSitAtSeat(student, tableId, seatIndex, seatsMap)) {
            emptyOptions.push({ tableId, seatIndex });
          }
        } else {
          // consider a swap/chain only if occupant is movable
          const oData = studentsData[occupant] || {};
          const occupantSwappable =
            (!oData.lockedSeat || oData.lockedSeat.mode === 'grid') &&
            (!oData.lockedTable || oData.lockedTable === tableId); // can move (maybe within same table)

          if (
            occupantSwappable &&
            canSitIgnoringOccupant(student, tableId, seatIndex, seatsMap)
          ) {
            swapOptions.push({ tableId, seatIndex, occupant });
          }
        }
      }
    }

    // randomness for variety
    shuffleArray(emptyOptions);
    shuffleArray(swapOptions);

    // Try easy: empty seats first
    for (const { tableId, seatIndex } of emptyOptions) {
      seatsMap[tableId][seatIndex] = student;
      // success
      removeFromPool(student);
      return true;
    }

    // Try swaps/chains
    for (const { tableId, seatIndex, occupant } of swapOptions) {
      // Move student in, free the occupant
      const prevLoc = findStudentLocation(seatsMap, student); // should be null
      const old = occupant;
      seatsMap[tableId][seatIndex] = student;

      // Temporarily unseat the occupant
      // (We know exactly where they were: same table+seatIndex)
      // Now try to place the displaced student somewhere else
      if (tryPlace(old, visited)) {
        removeFromPool(student);
        return true;
      }

      // Revert
      seatsMap[tableId][seatIndex] = old;
      if (prevLoc) seatsMap[prevLoc.tableId][prevLoc.seatIndex] = student; // (prevLoc shouldn't exist here)
    }

    return false;
  }

  if (pool.length) {
    // Order leftovers by difficulty (hardest first)
    pool.sort((a, b) => constraintScore(a) - constraintScore(b));
    for (const s of [...pool]) {
      if (!tryPlace(s)) {
        console.warn(`Could not place ${s} — constraints may be impossible.`);
      }
    }
  }

  // ---------- STEP 5: (optional) your single-person table balancing (unchanged) ----------
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

      if (studentsData[singleStudent]?.lockedSeat && studentsData[singleStudent].lockedSeat.mode !== 'grid') continue;
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

      // Fallback: bring in a flexible student
      if (!movedOut) {
        seatsMap[sourceTableId][sourceSeatIndex] = singleStudent; // put back

        const flexible = [];
        for (const tId in seatsMap) {
          seatsMap[tId].forEach((sName, idx) => {
            if (!sName) return;
            const sData = studentsData[sName] || {};
            if ((!sData.lockedSeat || sData.lockedSeat.mode === 'grid') && !sData.lockedTable && (!sData.blacklist || sData.blacklist.length === 0)) {
              flexible.push({ student: sName, fromTableId: tId, fromIdx: idx });
            }
          });
        }
        shuffleArray(flexible);

        for (const candidate of flexible) {
          const { student: flexStudent, fromTableId, fromIdx } = candidate;
          if (seatsMap[fromTableId][fromIdx] !== flexStudent) continue;

          seatsMap[fromTableId][fromIdx] = null;
          const targetEmptyIdx = seatsMap[sourceTableId].indexOf(null);
          if (targetEmptyIdx !== -1 && canSitAtSeat(flexStudent, sourceTableId, targetEmptyIdx, seatsMap)) {
            const afterCount = seatsMap[fromTableId].filter(s => s !== null).length;
            if (!(afterCount === 1 && seatsMap[fromTableId].length > 1)) {
              seatsMap[sourceTableId][targetEmptyIdx] = flexStudent;
              movedSomeone = true;
              break;
            }
          }
          seatsMap[fromTableId][fromIdx] = flexStudent;
        }
      }
    }

    if (!movedSomeone) break;
    attempt++;
  }

  if (attempt === maxAttempts) {
    console.warn('Reached max attempts resolving single-person tables.');
  }

  // ---------- Write assignments back to DOM ----------
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

  // Final sanity check & log
  if (pool.length) {
    console.warn('Unplaced students after randomization (constraints too tight?):', pool);
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
    if (isGridMode()) return;
    createTable();
    saveTables();
  });

  // Add "Randomize Seating" button below existing buttons
  const randomizeBtn = document.createElement('button');
  randomizeBtn.textContent = 'Random seats, or press R';
  randomizeBtn.id = 'randomizeSeatingBtn';
  addTableBtn.parentNode.insertBefore(randomizeBtn, addTableBtn.nextSibling);
  randomizeBtn.addEventListener('click', randomizeSeating);

  syncModeControls();
}

// ✅ Correct usage: call `init()` after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  loadClassList();
  migrateClassLayoutsToSharedLibrary();
  refreshClassSelector();
  loadClassData(currentClass);
  init(); // only called once here!
});


document.getElementById('bulk-add-btn').addEventListener('click', () => {
  const textarea = document.getElementById('bulk-add-textarea');
  const rawText = textarea.value.trim();
  if (!rawText) return alert('Please paste some student names first.');

  const newNames = rawText.split(/\r?\n/).map(name => name.trim()).filter(name => name.length > 0);
  const selectedGroupId = hasStudentGroups() ? bulkGroupSelect.value || getDefaultGroupId() : '';
  let addedCount = 0;

  newNames.forEach(name => {
    if (!manualStudentNames.has(name)) {
      manualStudentNames.add(name);
    }

    if (!studentsData[name]) {
      studentsData[name] = { lockedSeat: null, lockedTable: null, blacklist: [], present: true };
    }
    ensureStudentRecord(name);
    if (selectedGroupId) {
      studentsData[name].groupId = selectedGroupId;
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
    requestAnimationFrame(fitAllGridSeatNames);
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
    requestAnimationFrame(fitAllGridSeatNames);
  }
});

// Also listen for fullscreen change to sync class toggle & button text (handles ESC key)
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    classroomDiv.classList.remove('fullscreen-classroom');
    fullscreenBtn.textContent = 'Fullscreen Classroom';
  }
  requestAnimationFrame(fitAllGridSeatNames);
});
