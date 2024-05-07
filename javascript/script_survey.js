document.addEventListener("DOMContentLoaded", function () {
    const surveyForm = document.getElementById("surveyForm");
    const errorMessage = document.getElementById("errorMessage");
    const thankYouMessage = document.getElementById("thankYouMessage");
    const submitBtn = document.getElementById("submitBtn");

// Function to check if all questions are answered
function validateForm() {
    // Get all required questions in the survey (those without the "optional" class)
    const requiredQuestions = document.querySelectorAll(".question:not(.optional)");

    // Loop through each required question
    for (const question of requiredQuestions) {
        // Find the input field (input, select, or textarea) within the question
        const input = question.querySelector("input, select, textarea");

        // Check the type of the input field
        if (input.type === "text" && !input.value.trim()) {
            // If it's a text input and it's empty or only contains whitespace
            const labelText = question.querySelector("label").textContent;
            errorMessage.textContent = `Please answer ${labelText}`;
            return false;
        }

        if (input.type === "select-one" && input.value === "") {
            // If it's a select dropdown and no option is selected
            const labelText = question.querySelector("label").textContent;
            errorMessage.textContent = `Please select an option for ${labelText}`;
            return false;
        }

        if (input.type === "textarea" && !input.value.trim()) {
            // If it's a textarea and it's empty or only contains whitespace
            const labelText = question.querySelector("label").textContent;
            errorMessage.textContent = `Please provide a response for ${labelText}`;
            return false;
        }

        if (input.type === "radio" || input.type === "checkbox") {
            // If it's a radio button or checkbox input
            const options = question.querySelectorAll("input[type='radio'], input[type='checkbox']");
            let answered = false;
            for (const option of options) {
                // Check if at least one option is checked
                if (option.checked) {
                    answered = true;
                    break;
                }
            }
            
            if (!answered) {
                // If no option is checked
                const labelText = question.querySelector("label").textContent;
                errorMessage.textContent = `Please select an option for ${labelText}`;
                return false; 
            }
        }
    }
    return true; 
}


    // Function to clear the error message
    function clearErrorMessage() {
        errorMessage.textContent = "";
    }

    // Event listener for form submission
    submitBtn.addEventListener("click", function () {
        clearErrorMessage();
        if (validateForm()) {
            const formData = new FormData(surveyForm);
            // Make AJAX request
            fetch("email.php", {
                method: "POST",
                body: formData
            })
            .then(response => {
                if (response.ok) {
                    // Form is valid and email was sent successfully
                    const userName = document.querySelector("input[name='userName']").value;
                    thankYouMessage.classList.remove("hidden");
                    thankYouMessage.querySelector("#userName").textContent = userName;
                    surveyForm.style.display = "none";
                } else {
                    // Handle error
                    console.error("Error sending email");
                    errorMessage.textContent = "An error occurred in email. Please try again later.";
                }
            })
            .catch(error => {
                console.error("Error:", error);
                errorMessage.textContent = "An error occurred. Please try again later.";
            });
        }
    });

    surveyForm.addEventListener("input", clearErrorMessage);
});
