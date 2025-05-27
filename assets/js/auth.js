// Xác thực người dùng và trạng thái đăng nhập
document.addEventListener('DOMContentLoaded', function() {
    // Kiểm tra trạng thái đăng nhập và cập nhật UI
    updateUIBasedOnLoginState();
    
    // Thêm trình xử lý đăng xuất
    setupLogoutHandlers();
});

// Cập nhật UI dựa trên trạng thái đăng nhập
function updateUIBasedOnLoginState() {
    const isLoggedIn = checkIsLoggedIn();
    
    // Lấy tên người dùng và email đã đăng nhập
    const userData = getUserData();
    
    // Thay đổi liên kết menu
    updateNavigationMenu(isLoggedIn);
    
    // Nếu đang ở trang hồ sơ và chưa đăng nhập, chuyển hướng đến trang đăng nhập
    if (window.location.pathname.includes('profile.html') && !isLoggedIn) {
        window.location.href = 'login.html';
    }
    
    // Nếu đang ở trang đăng nhập và đã đăng nhập, hiển thị thông báo
    if (window.location.pathname.includes('login.html') && isLoggedIn) {
        showLoginStatus(userData);
    }
}

// Kiểm tra xem người dùng đã đăng nhập chưa
function checkIsLoggedIn() {
    const localLoginState = localStorage.getItem('codemaster_login_state');
    const sessionLoginState = sessionStorage.getItem('codemaster_login_state');
    
    return !!(localLoginState || sessionLoginState);
}

// Lấy dữ liệu người dùng từ trạng thái đăng nhập
function getUserData() {
    const localLoginState = localStorage.getItem('codemaster_login_state');
    const sessionLoginState = sessionStorage.getItem('codemaster_login_state');
    
    // Ưu tiên sử dụng trạng thái phiên trước
    const loginState = sessionLoginState ? JSON.parse(sessionLoginState) : 
                      (localLoginState ? JSON.parse(localLoginState) : null);
    
    if (!loginState) return null;
    
    // Lấy thông tin người dùng từ email
    const email = loginState.email;
    const storedUsers = JSON.parse(localStorage.getItem('codemaster_users')) || [];
    const user = storedUsers.find(user => user.email === email);
    
    // Nếu không tìm thấy người dùng (trường hợp tài khoản demo), tạo một người dùng mặc định
    if (!user && email === 'demo@example.com') {
        return {
            name: 'Người Dùng Demo',
            email: 'demo@example.com'
        };
    }
    
    return user;
}

// Cập nhật menu điều hướng dựa trên trạng thái đăng nhập
function updateNavigationMenu(isLoggedIn) {
    const navList = document.querySelector('nav ul');
    if (!navList) return;
    
    // Tìm hoặc tạo liên kết đăng nhập/hồ sơ
    let authNavItem = Array.from(navList.children).find(li => {
        const link = li.querySelector('a');
        return link && (link.href.includes('login.html') || link.href.includes('profile.html'));
    });
    
    if (!authNavItem) {
        authNavItem = document.createElement('li');
        navList.appendChild(authNavItem);
    }
    
    // Cập nhật liên kết dựa trên trạng thái đăng nhập
    authNavItem.innerHTML = isLoggedIn 
        ? '<a href="profile.html">Hồ Sơ Của Tôi</a>'
        : '<a href="login.html">Đăng Nhập</a>';
    
    // Đặt lớp active nếu đang ở trang hiện tại
    const navLinks = navList.querySelectorAll('a');
    const currentPath = window.location.pathname.split('/').pop();
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Hiển thị trạng thái đăng nhập trên trang đăng nhập
function showLoginStatus(userData) {
    const loginContainer = document.querySelector('.login-container');
    if (!loginContainer) return;
    
    const logoutNotice = document.createElement('div');
    logoutNotice.className = 'logout-notice';
    logoutNotice.innerHTML = `
        <p>Bạn đã đăng nhập với tài khoản <strong>${userData ? userData.name : 'Không xác định'}</strong>.</p>
        <div class="logout-actions">
            <a href="profile.html" class="btn btn-primary">Đi đến Hồ Sơ</a>
            <button class="btn btn-outline logout-btn">Đăng Xuất</button>
        </div>
    `;
    
    // Thêm phần tử vào đầu container
    loginContainer.insertBefore(logoutNotice, loginContainer.firstChild);
}

// Thiết lập trình xử lý đăng xuất
function setupLogoutHandlers() {
    // Thêm nút đăng xuất vào footer nếu đã đăng nhập
    const isLoggedIn = checkIsLoggedIn();
    
    if (isLoggedIn) {
        // Tìm hoặc tạo phần tử đăng xuất
        const logoutBtns = document.querySelectorAll('.logout-btn');
        
        logoutBtns.forEach(btn => {
            btn.addEventListener('click', logout);
        });
    }
}

// Đăng xuất người dùng
function logout() {
    // Xóa dữ liệu đăng nhập từ localStorage và sessionStorage
    localStorage.removeItem('codemaster_login_state');
    sessionStorage.removeItem('codemaster_login_state');
    
    // Hiển thị thông báo (nếu có hàm này)
    if (typeof showNotification === 'function') {
        showNotification('Đăng xuất thành công!', 'success');
    }
    
    // Làm mới trang sau 1 giây
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
} 