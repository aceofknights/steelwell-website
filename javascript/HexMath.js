document.addEventListener("DOMContentLoaded", function () {
  const MAX_FACTOR = 12;
  const WIN_LENGTH = 4;
  const HEX_SIZE = 44;
  const SQRT_THREE = Math.sqrt(3);
  const directions = [
    [1, 0],
    [0, 1],
    [1, -1],
  ];

  const board = document.getElementById("hexBoard");
  const turnMessage = document.getElementById("turnMessage");
  const factorAControls = document.getElementById("factorAControls");
  const factorBControls = document.getElementById("factorBControls");
  const playerOneCard = document.getElementById("playerOneCard");
  const playerTwoCard = document.getElementById("playerTwoCard");
  const playerOneCount = document.getElementById("playerOneCount");
  const playerTwoCount = document.getElementById("playerTwoCount");
  const newGameBtn = document.getElementById("newGameBtn");
  const victoryOverlay = document.getElementById("victoryOverlay");
  const victoryCard = document.getElementById("victoryCard");
  const victoryTitle = document.getElementById("victoryTitle");
  const victoryNewGameBtn = document.getElementById("victoryNewGameBtn");

  const products = getUniqueProducts();
  const cells = getHexCells().slice(0, products.length);
  const cellsByCoord = new Map();
  const cellsByProduct = new Map();
  const gameWins = [0, 0];
  let factors = [1, 1];
  let currentPlayer = 1;
  let gameOver = false;
  let lastPickedCell = null;

  function getUniqueProducts() {
    const values = new Set();

    for (let a = 1; a <= MAX_FACTOR; a++) {
      for (let b = 1; b <= MAX_FACTOR; b++) {
        values.add(a * b);
      }
    }

    return Array.from(values).sort(function (a, b) {
      return a - b;
    });
  }

  function getHexCells() {
    const radius = 4;
    const blockedCoords = new Set(["4,-4", "-4,4"]);
    const coords = [];

    for (let q = -radius; q <= radius; q++) {
      const minR = Math.max(-radius, -q - radius);
      const maxR = Math.min(radius, -q + radius);

      for (let r = minR; r <= maxR; r++) {
        const key = getCoordKey(q, r);

        if (!blockedCoords.has(key)) {
          coords.push({ q, r });
        }
      }
    }

    return coords;
  }

  function startGame() {
    const shuffledProducts = shuffle(products);
    factors = [getRandomFactor(), getRandomFactor()];
    currentPlayer = 1;
    gameOver = false;
    lastPickedCell = null;
    hideVictorySplash();
    cellsByCoord.clear();
    cellsByProduct.clear();
    board.innerHTML = "";

    cells.forEach(function (cell, index) {
      const product = shuffledProducts[index];
      const hex = document.createElement("button");
      const x = HEX_SIZE * SQRT_THREE * (cell.q + cell.r / 2);
      const y = HEX_SIZE * 1.5 * cell.r;

      hex.type = "button";
      hex.className = "hex-cell";
      hex.textContent = product;
      hex.dataset.product = product;
      hex.dataset.q = cell.q;
      hex.dataset.r = cell.r;
      hex.style.setProperty("--hex-x", x + "px");
      hex.style.setProperty("--hex-y", y + "px");

      board.appendChild(hex);
      const cellData = {
        q: cell.q,
        r: cell.r,
        product,
        owner: 0,
        element: hex,
      };

      cellsByCoord.set(getCoordKey(cell.q, cell.r), cellData);
      cellsByProduct.set(product, cellData);
    });

    renderFactorButtons();
    updateStatus("Player 1: change one number.");
  }

  function renderFactorButtons() {
    factorAControls.innerHTML = "";
    factorBControls.innerHTML = "";

    for (let value = 1; value <= MAX_FACTOR; value++) {
      factorAControls.appendChild(createFactorButton(0, value));
      factorBControls.appendChild(createFactorButton(1, value));
    }
  }

  function createFactorButton(index, value) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = value;
    button.dataset.factorIndex = index;
    button.dataset.factorValue = value;
    button.addEventListener("click", function () {
      chooseFactor(index, value);
    });

    return button;
  }

  function chooseFactor(index, value) {
    if (gameOver) {
      return;
    }

    if (factors[index] === value) {
      updateStatus("Pick a different number for this move.");
      return;
    }

    const nextFactors = factors.slice();
    nextFactors[index] = value;
    const neededProduct = nextFactors[0] * nextFactors[1];
    const cell = cellsByProduct.get(neededProduct);

    if (!cell) {
      updateStatus("That answer is not on the board. Choose another number.");
      return;
    }

    if (cell.owner) {
      updateStatus(neededProduct + " is already claimed. Choose another number.");
      return;
    }

    claimCell(cell, nextFactors);
  }

  function claimCell(cell, nextFactors) {
    const player = currentPlayer;

    cell.owner = player;
    cell.element.classList.add("claimed", "player-" + player);
    markLastPicked(cell);
    factors = nextFactors;

    if (hasWinningLine(cell)) {
      gameOver = true;
      gameWins[player - 1]++;
      updateStatus("Player " + player + " wins with 4 in a row!");
      showVictorySplash(player);
      return;
    }

    currentPlayer = player === 1 ? 2 : 1;
    updateStatus("Player " + currentPlayer + ": change one number.");
  }

  function markLastPicked(cell) {
    if (lastPickedCell) {
      lastPickedCell.element.classList.remove("last-picked");
    }

    cell.element.classList.remove("last-picked");
    void cell.element.offsetWidth;
    cell.element.classList.add("last-picked");
    lastPickedCell = cell;
  }

  function hasWinningLine(startCell) {
    return directions.some(function (direction) {
      const total =
        1 +
        countOwned(startCell, direction[0], direction[1]) +
        countOwned(startCell, -direction[0], -direction[1]);

      return total >= WIN_LENGTH;
    });
  }

  function countOwned(startCell, qStep, rStep) {
    let count = 0;
    let q = startCell.q + qStep;
    let r = startCell.r + rStep;
    let nextCell = cellsByCoord.get(getCoordKey(q, r));

    while (nextCell && nextCell.owner === currentPlayer) {
      count++;
      q += qStep;
      r += rStep;
      nextCell = cellsByCoord.get(getCoordKey(q, r));
    }

    return count;
  }

  function updateStatus(message) {
    turnMessage.textContent = message;
    playerOneCard.classList.toggle("active", currentPlayer === 1 && !gameOver);
    playerTwoCard.classList.toggle("active", currentPlayer === 2 && !gameOver);
    playerOneCount.textContent = gameWins[0];
    playerTwoCount.textContent = gameWins[1];
    updateFactorHighlights();
  }

  function showVictorySplash(player) {
    victoryOverlay.classList.remove("hidden", "player-1", "player-2");
    victoryOverlay.classList.add("player-" + player);
    victoryCard.classList.remove("player-1", "player-2");
    victoryCard.classList.add("player-" + player);
    victoryTitle.textContent = "Player " + player + " wins!";
  }

  function hideVictorySplash() {
    victoryOverlay.classList.add("hidden");
    victoryOverlay.classList.remove("player-1", "player-2");
    victoryCard.classList.remove("player-1", "player-2");
  }

  function updateFactorHighlights() {
    const factorButtons = document.querySelectorAll(".factor-buttons button");

    factorButtons.forEach(function (button) {
      const factorIndex = Number(button.dataset.factorIndex);
      const factorValue = Number(button.dataset.factorValue);
      button.classList.toggle("selected", factors[factorIndex] === factorValue);
    });
  }

  function getCoordKey(q, r) {
    return q + "," + r;
  }

  function getRandomFactor() {
    return Math.floor(Math.random() * MAX_FACTOR) + 1;
  }

  function shuffle(items) {
    const copy = items.slice();

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }

    return copy;
  }

  newGameBtn.addEventListener("click", startGame);
  victoryNewGameBtn.addEventListener("click", startGame);
  startGame();
});
