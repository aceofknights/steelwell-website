<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data
    $userName = $_POST['userName'];
    $q1 = $_POST['q1'];
    $q2 = $_POST['q2'];
    $q3 = $_POST['q3'];
    $q4 = isset($_POST['q4']) ? implode(", ", $_POST['q4']) : ''; // Convert array to comma-separated string
    $q5 = $_POST['q5'];

    // Compose email message
    $to = 'sizzle01745@yahoo.com'; // Change this to your email address
    $subject = 'Feedback Survey Submission';
    $message = "Name: $userName\n";
    $message .= "Rating: $q1\n";
    $message .= "Improvements: $q2\n";
    $message .= "How heard: $q3\n";
    $message .= "Liked features: $q4\n";
    $message .= "Additional feedback: $q5\n";

    // Send email
    if (mail($to, $subject, $message)) {
        http_response_code(200);
    } else {
        http_response_code(500);
    }
} else {
    http_response_code(405); // Method Not Allowed
}
