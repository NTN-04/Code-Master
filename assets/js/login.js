// Chức năng Trang Đăng Nhập
document.addEventListener('DOMContentLoaded', function() {
    // Khởi tạo tabs
    initTabs();
    
    // Khởi tạo các trình xử lý biểu mẫu
    initFormHandlers();
    
    // Khởi tạo chức năng hiện/ẩn mật khẩu
    initPasswordToggles();
    
    // Kiểm tra trạng thái đăng nhập
    checkLoginStatus();
});

// Khởi tạo điều hướng tab
function initTabs() {
    const tabButtons = document.querySelectorAll('.login-tabs .tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Thêm sự kiện click cho các nút tab
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Loại bỏ lớp active từ tất cả các nút và nội dung
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Thêm lớp active cho nút được nhấp vào
            button.classList.add('active');
            
            // Hiển thị nội dung tương ứng
            const tabId = button.getAttribute('data-tab');
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.classList.add('active');
            }
        });
    });
}

// Khởi tạo xử lý biểu mẫu
function initFormHandlers() {
    // Xử lý biểu mẫu đăng nhập
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const rememberMe = document.getElementById('remember-me').checked;
            
            // Mô phỏng kiểm tra đăng nhập
            if (simulateLogin(email, password)) {
                // Lưu trạng thái đăng nhập
                saveLoginState(email, rememberMe);
                
                // Chuyển hướng sang trang hồ sơ
                window.location.href = 'profile.html';
            } else {
                showNotification('Email hoặc mật khẩu không đúng. Vui lòng thử lại.', 'error');
            }
        });
    }
    
    // Xử lý biểu mẫu đăng ký
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-password-confirm').value;
            const termsAgreed = document.getElementById('terms-agree').checked;
            
            // Kiểm tra mật khẩu
            if (password !== confirmPassword) {
                showNotification('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.', 'error');
                return;
            }
            
            if (password.length < 6) {
                showNotification('Mật khẩu phải có ít nhất 6 ký tự.', 'error');
                return;
            }
            
            // Kiểm tra đồng ý điều khoản
            if (!termsAgreed) {
                showNotification('Bạn phải đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.', 'error');
                return;
            }
            
            // Mô phỏng đăng ký thành công
            registerUser(name, email, password);
            showNotification('Đăng ký thành công! Bạn sẽ được chuyển hướng đến trang đăng nhập.', 'success');
            
            // Xóa biểu mẫu và chuyển sang tab đăng nhập sau 2 giây
            setTimeout(() => {
                registerForm.reset();
                document.querySelector('.tab-btn[data-tab="login"]').click();
                
                // Điền email vào biểu mẫu đăng nhập
                document.getElementById('login-email').value = email;
            }, 2000);
        });
    }
}

// Mô phỏng đăng nhập
function simulateLogin(email, password) {
    // Lấy dữ liệu người dùng từ localStorage
    const storedUsers = JSON.parse(localStorage.getItem('codemaster_users')) || [];
    
    // Kiểm tra xem người dùng có tồn tại không
    const user = storedUsers.find(user => user.email === email && user.password === password);
    
    // Nếu email là demo@example.com và mật khẩu là 123456, luôn đăng nhập thành công
    if (email === 'demo@example.com' && password === '123456') {
        return true;
    }
    
    return !!user;
}

// Mô phỏng đăng ký người dùng
function registerUser(name, email, password) {
    // Lấy người dùng hiện có từ localStorage
    const storedUsers = JSON.parse(localStorage.getItem('codemaster_users')) || [];
    
    // Tạo người dùng mới
    const newUser = {
        name,
        email,
        password,
        registeredAt: new Date().toISOString()
    };
    
    // Thêm người dùng mới vào mảng
    storedUsers.push(newUser);
    
    // Lưu trở lại localStorage
    localStorage.setItem('codemaster_users', JSON.stringify(storedUsers));
}

// Lưu trạng thái đăng nhập
function saveLoginState(email, rememberMe) {
    const loginState = {
        email,
        loggedIn: true,
        loginTime: new Date().toISOString()
    };
    
    if (rememberMe) {
        // Lưu trạng thái đăng nhập lâu dài trong localStorage
        localStorage.setItem('codemaster_login_state', JSON.stringify(loginState));
    } else {
        // Lưu trạng thái đăng nhập tạm thời trong sessionStorage
        sessionStorage.setItem('codemaster_login_state', JSON.stringify(loginState));
    }
}

// Kiểm tra trạng thái đăng nhập
function checkLoginStatus() {
    const localLoginState = localStorage.getItem('codemaster_login_state');
    const sessionLoginState = sessionStorage.getItem('codemaster_login_state');
    
    if (localLoginState || sessionLoginState) {
        // Người dùng đã đăng nhập, thêm nút đăng xuất vào trang đăng nhập
        const loginContainer = document.querySelector('.login-container');
        if (loginContainer) {
            const logoutNotice = document.createElement('div');
            logoutNotice.className = 'logout-notice';
            logoutNotice.innerHTML = `
                <p>Bạn đã đăng nhập. Bạn có muốn:</p>
                <div class="logout-actions">
                    <a href="profile.html" class="btn btn-primary">Đi đến Hồ Sơ</a>
                    <button class="btn btn-outline logout-btn">Đăng Xuất</button>
                </div>
            `;
            
            // Thêm phần tử vào đầu container
            loginContainer.insertBefore(logoutNotice, loginContainer.firstChild);
            
            // Thêm sự kiện cho nút đăng xuất
            const logoutBtn = logoutNotice.querySelector('.logout-btn');
            logoutBtn.addEventListener('click', logout);
        }
    }
}

// Đăng xuất người dùng
function logout() {
    // Xóa dữ liệu đăng nhập từ localStorage và sessionStorage
    localStorage.removeItem('codemaster_login_state');
    sessionStorage.removeItem('codemaster_login_state');
    
    // Hiển thị thông báo
    showNotification('Đăng xuất thành công!', 'success');
    
    // Làm mới trang sau 1 giây
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

// Khởi tạo nút hiện/ẩn mật khẩu
function initPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.toggle-password');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const passwordField = this.previousElementSibling;
            const icon = this.querySelector('i');
            
            // Chuyển đổi loại trường
            if (passwordField.type === 'password') {
                passwordField.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordField.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

// Hiển thị thông báo
function showNotification(message, type = 'success') {
    // Kiểm tra xem đã có thông báo nào chưa
    let notification = document.querySelector('.notification');
    
    // Nếu chưa có, tạo một thông báo mới
    if (!notification) {
        notification = document.createElement('div');
        notification.classList.add('notification');
        document.body.appendChild(notification);
    }
    
    // Đặt lớp kiểu và nội dung thông báo
    notification.className = 'notification';
    notification.classList.add(type);
    notification.textContent = message;
    
    // Hiển thị thông báo
    notification.classList.add('show');
    
    // Tự động ẩn thông báo sau 3 giây
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
} 