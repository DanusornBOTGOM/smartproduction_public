document.addEventListener('DOMContentLoaded', function() {
  const sidebar = document.getElementById('accordionSidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');
  
  if (!sidebar || !toggleBtn) {
    console.error('Sidebar or toggle button not found');
    return;
  }

  toggleBtn.addEventListener('mouseenter', function() {
    sidebar.classList.toggle('show');
  });

  sidebar.addEventListener('mouseleave', function(event) {
    if (!sidebar.contains(event.relatedTarget)) {
      sidebar.classList.remove('show')
    }
  });

  toggleBtn.addEventListener('mouseleave', function(event) {
    if (!sidebar.contains(event.relatedTarget)) {
      sidebar.classList.remove('show')
    }
  })

  // ปิด sidebar เมื่อกดปุ่ม Esc
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      sidebar.classList.remove('show');
    }
  });

  console.log('Sidebar script loaded');
});