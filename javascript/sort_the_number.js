document.addEventListener("DOMContentLoaded", function () {
    const cardBoxes = document.querySelectorAll(".card-box");
    const numbers = [1, 2, 3, 4, 5]; // Numbers to sort
    let expectedNumber = 1; // Initial expected number

    // Function to shuffle the numbers array
    function shuffleNumbers() {
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
    }

    // Function to handle click events on card boxes
    function handleBoxClick(event) {
        const clickedBox = event.target;
        const clickedNumber = parseInt(clickedBox.textContent);

        // Check if the clicked number is the expected number
        if (clickedNumber === expectedNumber) {
            // Mark the clicked box as clicked
            clickedBox.classList.add("clicked");

            // Update the expected number
            expectedNumber++;

            // Check if all numbers have been clicked
            if (expectedNumber > 5) {
                alert("Congratulations! You sorted all the numbers correctly!");
                resetGame();
            }
        } else {
            // If the clicked number is not the expected number
            alert("Game over! You clicked the wrong number. Please try again.");
            resetGame();
        }
    }

    // Function to reset the game
    function resetGame() {
        expectedNumber = 1; // Reset expected number
        cardBoxes.forEach(box => {
            box.textContent = "";
            box.classList.remove("clicked");
        });
        shuffleNumbers();
        assignNumbersToBoxes();
    }

    // Function to assign shuffled numbers to card boxes
    function assignNumbersToBoxes() {
        cardBoxes.forEach((box, index) => {
            box.textContent = numbers[index];
        });
    }

    // Add event listeners to card boxes
    cardBoxes.forEach(box => {
        box.addEventListener("click", handleBoxClick);
    });

    // Initial setup
    shuffleNumbers();
    assignNumbersToBoxes();
});
