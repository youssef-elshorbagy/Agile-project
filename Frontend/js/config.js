const API_URL = "http://localhost:3000";


// used multiple times so put here, function: handles the horizontal scrolling logic for courses section 
function scrollGrid(direction, containerId) {
    const container = document.getElementById(containerId);
    if(container) {
        const scrollAmount = 320; 
        
        if(direction === 'left') {
            container.scrollLeft -= scrollAmount;
        } else {
            container.scrollLeft += scrollAmount;
        }
    }
}