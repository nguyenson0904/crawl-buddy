Chốt lại cách lấy data Threads — quy trình chuẩn em đã dùng 

![✅](https://web.telegram.org/k/assets/img/emoji/2705.png)

 

![🎯](https://web.telegram.org/k/assets/img/emoji/1f3af.png)

 1. Fetch trang — Googlebot UA (key trick) wget -U "Mozilla/5.0 (compatible; Googlebot/2.1; ...)" -O /tmp/t.html "&lt;link threads&gt;" • Threads render bằng JS → HTML thô không có nội đung • Nhưng server render đầy đủ cho Googlebot → có caption, metadata, media, cả thread comments 

![📝](https://web.telegram.org/k/assets/img/emoji/1f4dd.png)

 2. Lấy main post • Regex: &lt;title&gt;, og:description → caption đầy • Regex metadata: "username", "taken_at", "like_count" → author, ngày, stats 

![🖼️](https://web.telegram.org/k/assets/img/emoji/1f5bc.png)

 3. Lấy carousel media (nếu có) • Tìm "carousel_media": → tìm ] đóng (đếm depth, respect \" escape) → json.loads • Unescape trước: \u002F→/, \u0025→%, \u0026→&amp;, \u003D→= • Mỗi item: chọn candidate lớn nhất trong image_versions2.candidates • Download: wget -H --referer="[https://www.threads.net/](https://www.threads.net/)" — CDN cần Referer, không thì 403 

![💬](https://web.telegram.org/k/assets/img/emoji/1f4ac.png)

 4. Lấy comments / thread replies (phần hay nhất) • Regex tất cả "text":"..." trong HTML → decode bằng json.loads('"'+c+'"') (xử escape đúng) • Lọc text dài / tiếng Việt → ra main post + các reply trong thread • Không cần API riêng — cả thread được nhúng trong HTML 

![😎](https://web.telegram.org/k/assets/img/emoji/1f60e.png)

 

![👁️](https://web.telegram.org/k/assets/img/emoji/1f441.png)

 5. Vision AI đọc hình — nếu media là screenshot/ảnh chứa nội đung --- Key takeaways: • Link threads.com/share/XXX hoạt động tốt với Googlebot UA • Mẹo unescape JSON nhiều lớp (\u0026 có thể lặp) • Media CDN luôn cần Referer header Muốn em lưu phần "fetch thread + comments" này vào [threads-download-guidelines.md](http://threads-download-guidelines.md) để lần sau làm nhanh hơn không Đại ca? 

![🦸‍♂️](https://web.telegram.org/k/assets/img/emoji/1f9b8-200d-2642.png)

