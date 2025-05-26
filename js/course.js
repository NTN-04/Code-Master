// DOM Elements for Course Page
document.addEventListener('DOMContentLoaded', function() {
    // Initialize module toggles
    initModuleToggles();
    
    // Initialize lesson navigation
    initLessonNavigation();
    
    // Initialize progress tracking
    initCourseProgress();
});

// Initialize module toggles to expand/collapse lesson lists
function initModuleToggles() {
    const moduleHeaders = document.querySelectorAll('.module-header');
    
    moduleHeaders.forEach(header => {
        const moduleId = header.getAttribute('data-toggle');
        const lessonList = document.getElementById(moduleId);
        
        // Set initial states
        header.setAttribute('aria-expanded', 'false');
        lessonList.classList.remove('expanded');
        
        // Add click event
        header.addEventListener('click', () => {
            const expanded = header.getAttribute('aria-expanded') === 'true';
            
            // Toggle the state
            header.setAttribute('aria-expanded', !expanded);
            
            if (expanded) {
                lessonList.classList.remove('expanded');
            } else {
                lessonList.classList.add('expanded');
            }
        });
    });
    
    // Open the first module by default
    if (moduleHeaders.length > 0) {
        const firstHeader = moduleHeaders[0];
        const firstModuleId = firstHeader.getAttribute('data-toggle');
        const firstLessonList = document.getElementById(firstModuleId);
        
        firstHeader.setAttribute('aria-expanded', 'true');
        firstLessonList.classList.add('expanded');
    }
}

// Initialize lesson navigation
function initLessonNavigation() {
    const lessonLinks = document.querySelectorAll('.lesson-link');
    const startCourseBtn = document.getElementById('start-course');
    
    // Start course button click
    if (startCourseBtn) {
        startCourseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Load the first lesson if available
            if (lessonLinks.length > 0) {
                const firstLesson = lessonLinks[0];
                activateLesson(firstLesson.getAttribute('data-lesson'));
                
                // Mark the first lesson as active
                firstLesson.classList.add('active');
            }
        });
    }
    
    // Lesson link clicks
    lessonLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            lessonLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Load the lesson content
            const lessonId = link.getAttribute('data-lesson');
            activateLesson(lessonId);
        });
    });
}

// Load and display a lesson's content
function activateLesson(lessonId) {
    // In a real implementation, we would load the lesson content from a server
    // or from pre-loaded content in the HTML
    
    // For demonstration, we'll simulate loading content
    const lessonContainer = document.querySelector('.lesson-container');
    
    if (lessonContainer) {
        // Show loading state
        lessonContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải bài học...</div>';
        
        // Simulate API call delay
        setTimeout(() => {
            // Get a sample lesson based on the ID
            const lessonContent = getSampleLessonContent(lessonId);
            
            // Update the container
            lessonContainer.innerHTML = lessonContent;
            
            // Initialize any interactive elements in the new content
            initLessonInteractivity();
            
            // Track the lesson as viewed
            trackLessonProgress(lessonId);
        }, 500);
    }
}

// Initialize interactive elements in lesson content
function initLessonInteractivity() {
    // Initialize code snippets highlighting
    // In a real implementation, you might use libraries like Prism.js
    
    // Initialize quizzes
    const quizOptions = document.querySelectorAll('.quiz-option');
    const checkAnswerBtns = document.querySelectorAll('.check-answer');
    
    quizOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Get all options in this quiz
            const quizQuestion = option.closest('.quiz-question');
            const options = quizQuestion.querySelectorAll('.quiz-option');
            
            // Remove selected class from all options
            options.forEach(opt => opt.classList.remove('selected'));
            
            // Add selected class to clicked option
            option.classList.add('selected');
            
            // Select the radio button
            const radio = option.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
            }
        });
    });
    
    checkAnswerBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            const quizQuestion = btn.closest('.quiz-question');
            const selectedOption = quizQuestion.querySelector('.quiz-option.selected');
            const feedback = quizQuestion.querySelector('.quiz-feedback');
            
            if (selectedOption && feedback) {
                const isCorrect = selectedOption.getAttribute('data-correct') === 'true';
                
                // Reset classes
                quizQuestion.querySelectorAll('.quiz-option').forEach(opt => {
                    opt.classList.remove('correct', 'incorrect');
                });
                
                // Add appropriate classes
                if (isCorrect) {
                    selectedOption.classList.add('correct');
                    feedback.classList.add('correct');
                    feedback.classList.remove('incorrect');
                    feedback.textContent = 'Chính xác! Làm tốt lắm!';
                } else {
                    selectedOption.classList.add('incorrect');
                    feedback.classList.add('incorrect');
                    feedback.classList.remove('correct');
                    feedback.textContent = 'Không chính xác. Hãy thử lại!';
                }
            }
        });
    });
    
    // Initialize exercise submission
    const exerciseSubmitBtns = document.querySelectorAll('.submit-exercise');
    
    exerciseSubmitBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // In a real implementation, you would process the exercise submission
            // For now, show a success message
            alert('Bài tập đã được gửi thành công!');
            
            // Mark this exercise as completed
            const exercise = btn.closest('.exercise-section');
            if (exercise) {
                exercise.classList.add('completed');
            }
        });
    });
}

// Track lesson progress
function trackLessonProgress(lessonId) {
    // Get the lesson link to mark as completed
    const lessonLink = document.querySelector(`.lesson-link[data-lesson="${lessonId}"]`);
    
    if (lessonLink) {
        // Mark as completed in UI
        lessonLink.classList.add('completed');
        
        // Change the check icon
        const checkIcon = lessonLink.querySelector('.lesson-check i');
        if (checkIcon) {
            checkIcon.classList.remove('fa-circle');
            checkIcon.classList.add('fa-check-circle');
        }
        
        // Store progress in local storage
        const courseId = 'html-css'; // Would be dynamic in a real implementation
        saveLessonCompletion(courseId, lessonId);
        
        // Update overall course progress
        updateOverallProgress(courseId);
    }
}

// Save lesson completion status
function saveLessonCompletion(courseId, lessonId) {
    // Get existing completed lessons
    let completedLessons = JSON.parse(localStorage.getItem(`${courseId}-completed-lessons`) || '[]');
    
    // Add this lesson if not already included
    if (!completedLessons.includes(lessonId)) {
        completedLessons.push(lessonId);
        localStorage.setItem(`${courseId}-completed-lessons`, JSON.stringify(completedLessons));
    }
}

// Initialize course progress from saved data
function initCourseProgress() {
    const courseId = 'html-css'; // Would be dynamic in a real implementation
    
    // Get completed lessons
    let completedLessons = JSON.parse(localStorage.getItem(`${courseId}-completed-lessons`) || '[]');
    
    // Mark each completed lesson in the UI
    completedLessons.forEach(lessonId => {
        const lessonLink = document.querySelector(`.lesson-link[data-lesson="${lessonId}"]`);
        
        if (lessonLink) {
            lessonLink.classList.add('completed');
            
            const checkIcon = lessonLink.querySelector('.lesson-check i');
            if (checkIcon) {
                checkIcon.classList.remove('fa-circle');
                checkIcon.classList.add('fa-check-circle');
            }
        }
    });
    
    // Update overall progress
    updateOverallProgress(courseId);
}

// Update overall course progress
function updateOverallProgress(courseId) {
    // Get completed lessons
    let completedLessons = JSON.parse(localStorage.getItem(`${courseId}-completed-lessons`) || '[]');
    
    // Count total lessons
    const totalLessons = document.querySelectorAll('.lesson-link').length;
    
    // Calculate progress percentage
    const progressPercentage = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;
    
    // Update progress bar
    const progressBar = document.getElementById('course-main-progress');
    if (progressBar) {
        const progressElement = progressBar.querySelector('.progress');
        const progressText = progressBar.nextElementSibling;
        
        if (progressElement && progressText) {
            progressElement.style.width = `${progressPercentage}%`;
            progressText.textContent = `${progressPercentage}% Hoàn Thành`;
        }
    }
    
    // Save overall progress
    localStorage.setItem(`course-progress-${courseId}`, progressPercentage);
}

// Sample lesson content (in a real app, this would come from a database or API)
function getSampleLessonContent(lessonId) {
    // Parse the lesson ID to get module and lesson numbers
    const [module, lesson] = lessonId.split('.');
    
    // Sample content for specific lessons
    if (module === '1' && lesson === '1') {
        return `
            <div class="lesson-content" id="lesson-1-1">
                <h2>HTML là gì?</h2>
                <div class="lesson-video">
                    <div class="video-placeholder">
                        <i class="fas fa-play-circle"></i>
                        <p>Bài học 1.1: HTML là gì?</p>
                    </div>
                </div>
                <div class="lesson-text">
                    <p>HTML (HyperText Markup Language) là ngôn ngữ đánh dấu tiêu chuẩn được sử dụng để tạo trang web. Nó mô tả cấu trúc của một trang web và bao gồm một loạt các phần tử giúp trình duyệt hiển thị nội dung.</p>
                    
                    <p>Các phần tử HTML được biểu diễn bằng thẻ, được viết bằng dấu ngoặc nhọn. Ví dụ:</p>
                    
                    <pre><code>&lt;h1&gt;Đây là một tiêu đề&lt;/h1&gt;
&lt;p&gt;Đây là một đoạn văn.&lt;/p&gt;</code></pre>
                    
                    <p>Các thẻ HTML thường xuất hiện theo cặp như <code>&lt;p&gt;</code> và <code>&lt;/p&gt;</code>. Thẻ đầu tiên trong một cặp là thẻ mở, thẻ thứ hai là thẻ đóng. Thẻ đóng được viết giống như thẻ mở, nhưng có dấu gạch chéo phía trước tên thẻ.</p>
                    
                    <div class="exercise-section">
                        <h3>Bài tập: Viết HTML đầu tiên của bạn</h3>
                        <p>Hãy thử viết một tài liệu HTML đơn giản với một tiêu đề và một đoạn văn.</p>
                        <textarea rows="6" class="code-editor" placeholder="Viết HTML của bạn tại đây..."></textarea>
                        <button class="btn btn-primary submit-exercise">Nộp Bài Tập</button>
                    </div>
                    
                    <div class="quiz-section">
                        <h3>Câu Hỏi Nhanh</h3>
                        <div class="quiz-question">
                            <p>HTML là viết tắt của cụm từ nào?</p>
                            <div class="quiz-options">
                                <label class="quiz-option" data-correct="true">
                                    <input type="radio" name="quiz1" value="a">
                                    <span>HyperText Markup Language</span>
                                </label>
                                <label class="quiz-option">
                                    <input type="radio" name="quiz1" value="b">
                                    <span>High-level Text Management Language</span>
                                </label>
                                <label class="quiz-option">
                                    <input type="radio" name="quiz1" value="c">
                                    <span>Hyperlink and Text Markup Language</span>
                                </label>
                                <label class="quiz-option">
                                    <input type="radio" name="quiz1" value="d">
                                    <span>Home Tool Markup Language</span>
                                </label>
                            </div>
                            <div class="quiz-feedback"></div>
                            <button class="btn btn-primary check-answer">Kiểm Tra Đáp Án</button>
                        </div>
                    </div>
                    
                    <div class="lesson-navigation">
                        <a href="#" class="btn btn-secondary prev-lesson">Bài Trước</a>
                        <a href="#" class="btn btn-primary next-lesson" data-next="1.2">Bài Tiếp Theo</a>
                    </div>
                </div>
            </div>
        `;
    } else if (module === '1' && lesson === '2') {
        return `
            <div class="lesson-content" id="lesson-1-2">
                <h2>Cấu Trúc Tài Liệu HTML</h2>
                <div class="lesson-video">
                    <div class="video-placeholder">
                        <i class="fas fa-play-circle"></i>
                        <p>Bài học 1.2: Cấu Trúc Tài Liệu HTML</p>
                    </div>
                </div>
                <div class="lesson-text">
                    <p>Mỗi tài liệu HTML đều có một cấu trúc bắt buộc bao gồm các khai báo và phần tử sau:</p>
                    
                    <pre><code>&lt;!DOCTYPE html&gt;
&lt;html&gt;
&lt;head&gt;
    &lt;title&gt;Tiêu Đề Trang&lt;/title&gt;
&lt;/head&gt;
&lt;body&gt;
    &lt;h1&gt;Đây Là Một Tiêu Đề&lt;/h1&gt;
    &lt;p&gt;Đây là một đoạn văn.&lt;/p&gt;
&lt;/body&gt;
&lt;/html&gt;</code></pre>
                    
                    <p>Hãy phân tích cấu trúc:</p>
                    
                    <ul>
                        <li><code>&lt;!DOCTYPE html&gt;</code>: Khai báo định nghĩa tài liệu này là HTML5</li>
                        <li><code>&lt;html&gt;</code>: Phần tử gốc của một trang HTML</li>
                        <li><code>&lt;head&gt;</code>: Chứa thông tin meta về tài liệu</li>
                        <li><code>&lt;title&gt;</code>: Chỉ định tiêu đề cho tài liệu</li>
                        <li><code>&lt;body&gt;</code>: Chứa nội dung trang hiển thị</li>
                    </ul>
                    
                    <div class="exercise-section">
                        <h3>Bài tập: Tạo một Tài Liệu HTML hoàn chỉnh</h3>
                        <p>Tạo một tài liệu HTML hoàn chỉnh với cấu trúc đúng, bao gồm tiêu đề, tiêu đề và nhiều đoạn văn.</p>
                        <textarea rows="8" class="code-editor" placeholder="Viết tài liệu HTML của bạn tại đây..."></textarea>
                        <button class="btn btn-primary submit-exercise">Nộp Bài Tập</button>
                    </div>
                    
                    <div class="lesson-navigation">
                        <a href="#" class="btn btn-secondary prev-lesson" data-prev="1.1">Bài Trước</a>
                        <a href="#" class="btn btn-primary next-lesson" data-next="1.3">Bài Tiếp Theo</a>
                    </div>
                </div>
            </div>
        `;
    } else {
        // For other lessons, return a generic template
        return `
            <div class="lesson-content" id="lesson-${module}-${lesson}">
                <h2>Chương ${module}, Bài ${lesson}</h2>
                <div class="lesson-video">
                    <div class="video-placeholder">
                        <i class="fas fa-play-circle"></i>
                        <p>Video Bài học ${module}.${lesson}</p>
                    </div>
                </div>
                <div class="lesson-text">
                    <p>Đây là nội dung mẫu cho Chương ${module}, Bài ${lesson}.</p>
                    <p>Trong khóa học hoàn chỉnh, phần này sẽ chứa các giải thích chi tiết, ví dụ và bài tập liên quan đến chủ đề cụ thể của bài học này.</p>
                    
                    <div class="exercise-section">
                        <h3>Bài tập</h3>
                        <p>Đây là bài tập mẫu sẽ được điều chỉnh cho phù hợp với bài học cụ thể này.</p>
                        <textarea rows="6" class="code-editor" placeholder="Viết mã của bạn tại đây..."></textarea>
                        <button class="btn btn-primary submit-exercise">Nộp Bài Tập</button>
                    </div>
                    
                    <div class="lesson-navigation">
                        <a href="#" class="btn btn-secondary prev-lesson">Bài Trước</a>
                        <a href="#" class="btn btn-primary next-lesson">Bài Tiếp Theo</a>
                    </div>
                </div>
            </div>
        `;
    }
} 