/**
 * Cấu hình IDE Templates cho các loại khóa học
 * Mỗi template định nghĩa ngôn ngữ hỗ trợ, chế độ chạy và code mẫu
 *
 * @module ide-config
 */

// ========================================
// ĐỊNH NGHĨA CÁC IDE TEMPLATES
// ========================================

/**
 * @typedef {Object} LanguageConfig
 * @property {string} id - ID ngôn ngữ
 * @property {string} name - Tên hiển thị
 * @property {string} monaco - Monaco language ID
 */

/**
 * @typedef {Object} TemplateFeatures
 * @property {boolean} livePreview - Cho phép xem trước kết quả
 * @property {boolean} console - Hiển thị console output
 * @property {boolean} splitView - Chia đôi màn hình (editor + preview)
 */

/**
 * @typedef {Object} IDETemplate
 * @property {string} name - Tên template
 * @property {LanguageConfig[]} languages - Danh sách ngôn ngữ hỗ trợ
 * @property {string} defaultLanguage - Ngôn ngữ mặc định
 * @property {string} runMode - Chế độ chạy code (web, console, api)
 * @property {TemplateFeatures} features - Các tính năng
 * @property {Object.<string, string>} defaultCode - Code mẫu cho từng ngôn ngữ
 */

/** @type {Object.<string, IDETemplate>} */
export const IDE_TEMPLATES = {
  // ========================================
  // WEB DEVELOPMENT (HTML/CSS/JS)
  // ========================================
  web: {
    name: "Phát triển Web",
    languages: [
      { id: "html", name: "HTML", monaco: "html" },
      { id: "css", name: "CSS", monaco: "css" },
      { id: "javascript", name: "JavaScript", monaco: "javascript" },
    ],
    defaultLanguage: "html",
    runMode: "web",
    features: {
      livePreview: true,
      console: false,
      splitView: true,
    },
    defaultCode: {
      html: `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
    }
    h1 { color: #333; margin-bottom: 10px; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Xin chào CodeMaster! 🚀</h1>
    <p>Bắt đầu viết code của bạn tại đây...</p>
  </div>
</body>
</html>`,
      css: `/* CSS Styles */
body {
  font-family: 'Segoe UI', Tahoma, sans-serif;
  background: linear-gradient(135deg, #5ebbff 0%, #a174ff 100%);
  min-height: 100vh;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}

h1 {
  color: #333;
  margin: 0;
}`,
      javascript: `// JavaScript Code
console.log("Xin chào CodeMaster! 🚀");

// Ví dụ: Tạo element và thêm vào DOM
const container = document.createElement('div');
container.style.cssText = \`
  font-family: Arial, sans-serif;
  padding: 40px;
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
\`;

container.innerHTML = \`
  <h1>Xin chào CodeMaster! 🚀</h1>
  <p>JavaScript đang chạy...</p>
  <p>Thời gian: \${new Date().toLocaleTimeString('vi-VN')}</p>
\`;

document.body.appendChild(container);`,
    },
  },

  // ========================================
  // PYTHON PROGRAMMING
  // ========================================
  python: {
    name: "Lập trình Python",
    languages: [{ id: "python", name: "Python", monaco: "python" }],
    defaultLanguage: "python",
    runMode: "pyodide",
    features: {
      livePreview: true, // Bật preview để hiển thị kết quả
      console: true,
      splitView: true,
    },
    defaultCode: {
      python: `# Python - Chào mừng đến với CodeMaster!
print("Xin chào CodeMaster! 🚀")

# Ví dụ: Biến và kiểu dữ liệu
name = "Học viên"
age = 20
score = 9.5

print(f"Tên: {name}")
print(f"Tuổi: {age}")
print(f"Điểm: {score}")

# Ví dụ: Vòng lặp
for i in range(1, 6):
    print(f"Số thứ {i}")

# Ví dụ: Hàm
def greet(name):
    return f"Xin chào, {name}!"

print(greet("CodeMaster"))`,
    },
  },

  // ========================================
  // JAVA PROGRAMMING
  // ========================================
  java: {
    name: "Lập trình Java",
    languages: [{ id: "java", name: "Java", monaco: "java" }],
    defaultLanguage: "java",
    runMode: "console",
    features: {
      livePreview: false,
      console: true,
      splitView: true,
    },
    defaultCode: {
      java: `// Java - Chào mừng đến với CodeMaster!
public class Main {
    public static void main(String[] args) {
        System.out.println("Xin chào CodeMaster! 🚀");
        
        // Ví dụ: Biến và kiểu dữ liệu
        String name = "Học viên";
        int age = 20;
        double score = 9.5;
        
        System.out.println("Tên: " + name);
        System.out.println("Tuổi: " + age);
        System.out.println("Điểm: " + score);
        
        // Ví dụ: Vòng lặp
        for (int i = 1; i <= 5; i++) {
            System.out.println("Số thứ " + i);
        }
    }
    
    // Ví dụ: Phương thức
    public static String greet(String name) {
        return "Xin chào, " + name + "!";
    }
}`,
    },
  },

  // ========================================
  // C/C++ PROGRAMMING
  // ========================================
  cpp: {
    name: "Lập trình C/C++",
    languages: [
      { id: "c", name: "C", monaco: "c" },
      { id: "cpp", name: "C++", monaco: "cpp" },
    ],
    defaultLanguage: "cpp",
    runMode: "console",
    features: {
      livePreview: false,
      console: true,
      splitView: true,
    },
    defaultCode: {
      c: `// C - Chào mừng đến với CodeMaster!
#include <stdio.h>

int main() {
    printf("Xin chào CodeMaster! 🚀\\n");
    
    // Ví dụ: Biến
    char name[] = "Học viên";
    int age = 20;
    float score = 9.5;
    
    printf("Tên: %s\\n", name);
    printf("Tuổi: %d\\n", age);
    printf("Điểm: %.1f\\n", score);
    
    // Ví dụ: Vòng lặp
    for (int i = 1; i <= 5; i++) {
        printf("Số thứ %d\\n", i);
    }
    
    return 0;
}`,
      cpp: `// C++ - Chào mừng đến với CodeMaster!
#include <iostream>
#include <string>
using namespace std;

int main() {
    cout << "Xin chào CodeMaster! 🚀" << endl;
    
    // Ví dụ: Biến
    string name = "Học viên";
    int age = 20;
    double score = 9.5;
    
    cout << "Tên: " << name << endl;
    cout << "Tuổi: " << age << endl;
    cout << "Điểm: " << score << endl;
    
    // Ví dụ: Vòng lặp
    for (int i = 1; i <= 5; i++) {
        cout << "Số thứ " << i << endl;
    }
    
    return 0;
}`,
    },
  },

  // ========================================
  // REACT DEVELOPMENT
  // ========================================
  react: {
    name: "Phát triển React",
    languages: [
      { id: "jsx", name: "JSX", monaco: "javascript" },
      { id: "css", name: "CSS", monaco: "css" },
    ],
    defaultLanguage: "jsx",
    runMode: "react",
    features: {
      livePreview: true,
      console: true,
      splitView: true,
    },
    defaultCode: {
      jsx: `// React Component - CodeMaster
function App() {
  const [count, setCount] = React.useState(0);
  
  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      padding: '40px',
      textAlign: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white'
    }}>
      <h1>Xin chào CodeMaster! 🚀</h1>
      <p>Đây là React Component</p>
      <button 
        onClick={() => setCount(count + 1)}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer',
          borderRadius: '8px',
          border: 'none',
          background: 'white',
          color: '#667eea'
        }}
      >
        Đã nhấn {count} lần
      </button>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
      css: `/* React CSS */
.container {
  font-family: Arial, sans-serif;
  padding: 40px;
  text-align: center;
}

.button {
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  transition: transform 0.2s;
}

.button:hover {
  transform: scale(1.05);
}`,
    },
  },

  // ========================================
  // MOBILE DEVELOPMENT (Flutter/Dart)
  // ========================================
  mobile: {
    name: "Phát triển Mobile",
    languages: [{ id: "dart", name: "Dart/Flutter", monaco: "dart" }],
    defaultLanguage: "dart",
    runMode: "dartpad",
    features: {
      livePreview: true,
      console: true,
      splitView: true,
    },
    defaultCode: {
      dart: `// Flutter - Chào mừng đến với CodeMaster!
import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(
          title: const Text('CodeMaster Flutter'),
          backgroundColor: Colors.purple,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                'Xin chào CodeMaster! 🚀',
                style: TextStyle(fontSize: 24),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () {
                  print('Button pressed!');
                },
                child: const Text('Nhấn vào đây'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}`,
    },
  },

  // ========================================
  // DATABASE & SQL
  // ========================================
  database: {
    name: "Cơ sở dữ liệu",
    languages: [{ id: "sql", name: "SQL", monaco: "sql" }],
    defaultLanguage: "sql",
    runMode: "sql",
    features: {
      livePreview: true,
      console: true,
      splitView: true,
    },
    defaultCode: {
      sql: `-- SQL - Chào mừng đến với CodeMaster!

-- Tạo bảng học viên
CREATE TABLE students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    age INT,
    score DECIMAL(4,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Thêm dữ liệu mẫu
INSERT INTO students (name, email, age, score) VALUES
    ('Nguyễn Văn A', 'a@email.com', 20, 8.5),
    ('Trần Thị B', 'b@email.com', 21, 9.0),
    ('Lê Văn C', 'c@email.com', 19, 7.5);

-- Truy vấn dữ liệu
SELECT * FROM students;

-- Truy vấn có điều kiện
SELECT name, score 
FROM students 
WHERE score >= 8.0 
ORDER BY score DESC;`,
    },
  },
};

// ========================================
// HÀM TIỆN ÍCH
// ========================================

/**
 * Lấy cấu hình template theo tên
 * @param {string} templateName - Tên template (web, python, java, ...)
 * @returns {IDETemplate} Cấu hình template (mặc định: web)
 */
export function getTemplateConfig(templateName) {
  return IDE_TEMPLATES[templateName] || IDE_TEMPLATES.web;
}

/**
 * Kiểm tra template có tồn tại không
 * @param {string} templateName - Tên template
 * @returns {boolean}
 */
export function isValidTemplate(templateName) {
  return templateName in IDE_TEMPLATES;
}

/**
 * Lấy danh sách tất cả templates
 * @returns {Array<{id: string, name: string}>}
 */
export function getAllTemplates() {
  return Object.entries(IDE_TEMPLATES).map(([id, template]) => ({
    id,
    name: template.name,
  }));
}

/**
 * Lấy code mẫu theo template và ngôn ngữ
 * @param {string} templateName - Tên template
 * @param {string} languageId - ID ngôn ngữ
 * @returns {string} Code mẫu
 */
export function getDefaultCode(templateName, languageId) {
  const template = getTemplateConfig(templateName);
  return template.defaultCode[languageId] || "";
}

/**
 * Kiểm tra template có hỗ trợ live preview không
 * @param {string} templateName - Tên template
 * @returns {boolean}
 */
export function hasLivePreview(templateName) {
  const template = getTemplateConfig(templateName);
  return template.features.livePreview;
}
