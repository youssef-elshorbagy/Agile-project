const API_URL = "http://localhost:3000";

function scrollGrid(direction, containerId) {
    const container = document.getElementById(containerId);
    if(container) {
        const scrollAmount = 320; // Width of card (300px) + Gap (20px)
        
        if(direction === 'left') {
            container.scrollLeft -= scrollAmount;
        } else {
            container.scrollLeft += scrollAmount;
        }
    }
}