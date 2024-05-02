$(document).ready(function () {
  // Array of image URLs
  var imageUrls = [
      '../assets/image1.jpg',
      '../assets/image2.jpg',
      '../assets/image3.jpg'
  ];

  // Reference to the image container
  var imageContainer = $('#image-container');

  // Apply CSS rules to the image container
  imageContainer.css({
      'display': 'flex',
      'flex-wrap': 'wrap',
      'justify-content': 'center',
      'align-items': 'center',
      'border-radius': '100px', 
  });

  // Iterate through the image URLs and create img elements
  $.each(imageUrls, function (index, imageUrl) {
      // Create a new image element
      var img = $('<img>');

      // Set the src attribute to the image URL
      img.attr('src', imageUrl);

      // Add CSS rules to the image
      img.css({
          'width': '300px',
          'height': '300px',
          'object-fit': 'cover',
          'border': '2px solid black', 
          'border-radius': '10px', 
          'margin': '10px',
      });

      // Append the image to the image container
      imageContainer.append(img);
  });
});
