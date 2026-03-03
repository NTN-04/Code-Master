/**
 * Cloudflare Worker - Proxy cho SePay Webhook
 * =============================================
 *
 * Worker này đóng vai trò trung gian giữa SePay và Google Apps Script
 * để xử lý vấn đề 302 redirect của Apps Script.
 *
 * Hướng dẫn setup:
 * 1. Đăng ký tài khoản Cloudflare (miễn phí): https://dash.cloudflare.com/sign-up
 * 2. Vào Workers & Pages > Create Application > Create Worker
 * 3. Đặt tên worker (vd: sepay-webhook-proxy)
 * 4. Paste code này vào editor
 * 5. Thay YOUR_GOOGLE_APPS_SCRIPT_URL bằng URL Apps Script của bạn
 * 6. Deploy
 * 7. Copy URL worker (dạng: https://sepay-webhook-proxy.your-account.workers.dev)
 * 8. Dán URL này vào SePay Dashboard > Webhook
 *
 * @author CodeMaster Team
 * @version 1.0.0
 */

// ⚠️ QUAN TRỌNG: Thay URL này bằng URL Google Apps Script của bạn
const GOOGLE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxRJFCmtykULruvqkJ62I-9LOLzgmfhjdBrBWxLes7lQjiZnuQhdPFXvs_8dUGs5ngV/exec";

export default {
  async fetch(request, env, ctx) {
    // Xử lý CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // GET request - kiểm tra worker đang hoạt động
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "SePay Webhook Proxy is running! 🚀",
          timestamp: new Date().toISOString(),
          target: GOOGLE_APPS_SCRIPT_URL,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // POST request - forward webhook từ SePay đến Google Apps Script
    if (request.method === "POST") {
      try {
        // 1. Đọc body từ SePay
        const requestBody = await request.text();

        console.log("📨 Received from SePay:", requestBody);

        // 2. Forward đến Google Apps Script (với redirect: "follow")
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: requestBody,
          redirect: "follow", // Quan trọng: tự động follow 302 redirect
        });

        // 3. Đọc response từ Apps Script
        const responseText = await response.text();

        console.log("📤 Response from Apps Script:", responseText);

        // 4. Trả về cho SePay
        return new Response(responseText, {
          status: 200, // Luôn trả về 200 cho SePay
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        console.error("❌ Error:", error.message);

        return new Response(
          JSON.stringify({
            success: false,
            message: "Proxy error: " + error.message,
            timestamp: new Date().toISOString(),
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }
    }

    // Các method khác
    return new Response("Method not allowed", { status: 405 });
  },
};
