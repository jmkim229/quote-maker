/* ===== 간편견적서 app.js ===== */
(function () {
  "use strict";

  var SESSION_KEY = "quickquote_session_v1"; /* 작성 중 문서 — 탭 닫으면 삭제 */
  var SUPPLIER_KEY = "quickquote_supplier_v1"; /* 공급자 정보 — '기억하기' 선택 시에만 저장 */
  var MAX_ROWS = 30;

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }

  function comma(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function parseNum(v) {
    if (v === null || v === undefined) return 0;
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  /* 숫자 → 한글 금액 (예: 1234500 → 일백이십삼만사천오백) */
  function numToKorean(num) {
    num = Math.round(num);
    if (num === 0) return "영";
    var digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    var smallUnits = ["", "십", "백", "천"];
    var bigUnits = ["", "만", "억", "조", "경"];
    var str = String(num);
    var result = "";
    var groupCount = Math.ceil(str.length / 4);
    str = str.padStart(groupCount * 4, "0");

    for (var g = 0; g < groupCount; g++) {
      var chunk = str.substr(g * 4, 4);
      var chunkStr = "";
      for (var i = 0; i < 4; i++) {
        var d = parseInt(chunk[i], 10);
        if (d === 0) continue;
        chunkStr += digits[d] + smallUnits[3 - i];
      }
      if (chunkStr) {
        result += chunkStr + bigUnits[groupCount - 1 - g];
      }
    }
    return result;
  }

  function todayStr() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function fmtDateKo(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    if (p.length !== 3) return iso;
    return p[0] + "년 " + parseInt(p[1], 10) + "월 " + parseInt(p[2], 10) + "일";
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- item rows ---------- */
  var itemsBody = $("items-body");

  function addRow(data) {
    if (itemsBody.children.length >= MAX_ROWS) return;
    data = data || {};
    var row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML =
      '<input type="text" class="it-name" placeholder="품명" value="' + esc(data.name) + '">' +
      '<input type="text" class="it-spec" placeholder="규격" value="' + esc(data.spec) + '">' +
      '<input type="text" class="it-qty num" inputmode="decimal" placeholder="0" value="' + esc(data.qty) + '">' +
      '<input type="text" class="it-price num" inputmode="numeric" placeholder="0" value="' + esc(data.price) + '">' +
      '<button type="button" class="row-del" title="행 삭제">✕</button>';
    itemsBody.appendChild(row);

    row.querySelector(".row-del").addEventListener("click", function () {
      if (itemsBody.children.length > 1) {
        row.remove();
      } else {
        row.querySelectorAll("input").forEach(function (inp) { inp.value = ""; });
      }
      update();
    });
    row.querySelectorAll("input").forEach(function (inp) {
      inp.addEventListener("input", update);
    });
    row.querySelector(".it-price").addEventListener("blur", function () {
      var v = parseNum(this.value);
      this.value = v ? comma(v) : "";
    });
  }

  function getItems() {
    var items = [];
    itemsBody.querySelectorAll(".item-row").forEach(function (row) {
      var name = row.querySelector(".it-name").value.trim();
      var spec = row.querySelector(".it-spec").value.trim();
      var qty = parseNum(row.querySelector(".it-qty").value);
      var price = parseNum(row.querySelector(".it-price").value);
      items.push({ name: name, spec: spec, qty: qty, price: price, amount: qty * price });
    });
    return items;
  }

  /* ---------- stamp upload ---------- */
  var stampData = "";
  $("stamp-file").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    if (f.size > 1024 * 1024) {
      alert("이미지는 1MB 이하로 올려 주세요.");
      this.value = "";
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      stampData = e.target.result;
      update();
    };
    reader.readAsDataURL(f);
  });
  $("stamp-remove").addEventListener("click", function () {
    stampData = "";
    $("stamp-file").value = "";
    update();
  });

  /* ---------- calculate & render ---------- */
  function update() {
    var items = getItems();
    var visible = items.filter(function (it) { return it.name || it.amount > 0; });

    var vatMode = document.querySelector('input[name="vat"]:checked').value;
    var supply = 0, vat = 0, total = 0;
    var rawSum = items.reduce(function (s, it) { return s + it.amount; }, 0);

    if (vatMode === "separate") {
      supply = rawSum;
      vat = Math.round(rawSum * 0.1);
      total = supply + vat;
    } else if (vatMode === "included") {
      total = rawSum;
      supply = Math.round(rawSum / 1.1);
      vat = total - supply;
    } else {
      supply = rawSum; vat = 0; total = rawSum;
    }

    /* form mini totals */
    $("mini-supply").textContent = comma(supply) + "원";
    $("mini-vat").textContent = comma(vat) + "원";
    $("mini-total").textContent = comma(total) + "원";

    /* sheet: meta */
    var client = $("f-client").value.trim();
    $("s-recipient").textContent = client ? client + "  귀하" : "                귀하";
    $("s-date").textContent = fmtDateKo($("f-date").value) || "-";
    $("s-quoteno").textContent = $("f-quoteno").value.trim() || "-";
    $("s-valid").textContent = $("f-valid").value;
    var cm = [];
    if ($("f-client-manager").value.trim()) cm.push("담당: " + $("f-client-manager").value.trim());
    if ($("f-client-tel").value.trim()) cm.push($("f-client-tel").value.trim());
    $("s-client-sub").textContent = cm.join("  ·  ");

    /* sheet: supplier */
    $("s-bizno").textContent = $("f-bizno").value.trim();
    $("s-company").textContent = $("f-company").value.trim();
    $("s-owner").textContent = $("f-owner").value.trim();
    $("s-addr").textContent = $("f-addr").value.trim();
    $("s-biztype").textContent = $("f-biztype").value.trim();
    $("s-bizitem").textContent = $("f-bizitem").value.trim();
    var contact = [$("f-tel").value.trim(), $("f-email").value.trim()].filter(Boolean).join(" / ");
    $("s-contact").textContent = contact;

    var stampArea = $("s-stamp");
    var thumb = $("stamp-thumb");
    if (stampData) {
      stampArea.innerHTML = '<img src="' + stampData + '" alt="인감">';
      thumb.innerHTML = '<img src="' + stampData + '" alt="도장 미리보기">';
      $("s-sign-hint").style.visibility = "hidden";
    } else {
      stampArea.innerHTML = "";
      thumb.innerHTML = "<span>미리<br>보기</span>";
      $("s-sign-hint").style.visibility = "visible";
    }

    /* sheet: grand bar */
    $("s-korean").textContent = total > 0 ? "金 " + numToKorean(total) + "원整" : "金                    원整";
    $("s-total-num").textContent = "(₩ " + comma(total) + ")";
    $("s-vat-label").textContent =
      vatMode === "separate" ? "(부가세 포함)" : vatMode === "included" ? "(부가세 포함)" : "(부가세 없음)";

    /* sheet: item rows — always fill to at least 8 rows for a clean form look */
    var MIN_SHEET_ROWS = 8;
    var tbody = $("s-items");
    tbody.innerHTML = "";
    var count = Math.max(visible.length, MIN_SHEET_ROWS);
    for (var i = 0; i < count; i++) {
      var it = visible[i];
      var tr = document.createElement("tr");
      if (it) {
        tr.innerHTML =
          '<td class="c">' + (i + 1) + "</td>" +
          "<td>" + esc(it.name) + "</td>" +
          '<td class="c">' + esc(it.spec) + "</td>" +
          '<td class="c">' + (it.qty ? comma(it.qty) : "") + "</td>" +
          '<td class="r">' + (it.price ? comma(it.price) : "") + "</td>" +
          '<td class="r">' + (it.amount ? comma(it.amount) : "") + "</td>";
      } else {
        tr.innerHTML = '<td class="c"></td><td></td><td></td><td></td><td></td><td class="r"></td>';
      }
      tbody.appendChild(tr);
    }

    $("s-supply").textContent = supply ? comma(supply) : "";
    $("s-vat").textContent = vatMode === "none" ? "-" : (vat ? comma(vat) : "");
    $("s-grand").textContent = total ? comma(total) : "";

    /* sheet: remarks */
    var rm = $("f-remarks").value.trim();
    $("s-remarks").textContent = rm || "· 상기 금액은 견적 유효기간 내에 한하여 유효합니다.";

    save();
    fitPreview();
  }

  /* ---------- persistence ---------- */
  function collectSupplier() {
    return {
      company: $("f-company").value,
      owner: $("f-owner").value,
      bizno: $("f-bizno").value,
      addr: $("f-addr").value,
      biztype: $("f-biztype").value,
      bizitem: $("f-bizitem").value,
      tel: $("f-tel").value,
      email: $("f-email").value,
      stamp: stampData
    };
  }

  function collectDoc() {
    return {
      quoteno: $("f-quoteno").value,
      date: $("f-date").value,
      valid: $("f-valid").value,
      client: $("f-client").value,
      clientManager: $("f-client-manager").value,
      clientTel: $("f-client-tel").value,
      vat: document.querySelector('input[name="vat"]:checked').value,
      remarks: $("f-remarks").value,
      items: getItems().map(function (it) {
        return { name: it.name, spec: it.spec, qty: it.qty || "", price: it.price ? comma(it.price) : "" };
      })
    };
  }

  function save() {
    /* 작성 중 문서: 새로고침 대비 임시 저장 (탭을 닫으면 자동 삭제) */
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ doc: collectDoc(), supplier: collectSupplier() }));
    } catch (e) { /* storage unavailable — ignore */ }
    /* 공급자 정보: '기억하기' 체크 시에만 영구 저장, 해제 시 즉시 삭제 */
    try {
      if ($("f-remember").checked) {
        localStorage.setItem(SUPPLIER_KEY, JSON.stringify(collectSupplier()));
      } else {
        localStorage.removeItem(SUPPLIER_KEY);
      }
    } catch (e) { /* storage unavailable — ignore */ }
  }

  function applySupplier(s) {
    if (!s) return;
    $("f-company").value = s.company || "";
    $("f-owner").value = s.owner || "";
    $("f-bizno").value = s.bizno || "";
    $("f-addr").value = s.addr || "";
    $("f-biztype").value = s.biztype || "";
    $("f-bizitem").value = s.bizitem || "";
    $("f-tel").value = s.tel || "";
    $("f-email").value = s.email || "";
    stampData = s.stamp || "";
  }

  function load() {
    /* 구버전 저장 데이터 정리 */
    try { localStorage.removeItem("quickquote_v1"); } catch (e) {}

    var sess = null, savedSupplier = null;
    try { sess = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) {}
    try { savedSupplier = JSON.parse(localStorage.getItem(SUPPLIER_KEY)); } catch (e) {}

    /* '기억하기' 체크 상태 = 저장된 공급자 정보 존재 여부 */
    $("f-remember").checked = !!savedSupplier;

    var doc = sess && sess.doc;
    if (doc) {
      $("f-quoteno").value = doc.quoteno || "";
      $("f-date").value = doc.date || todayStr();
      $("f-valid").value = doc.valid || "견적일로부터 30일";
      $("f-client").value = doc.client || "";
      $("f-client-manager").value = doc.clientManager || "";
      $("f-client-tel").value = doc.clientTel || "";
      $("f-remarks").value = doc.remarks || "";
      var vatInput = document.querySelector('input[name="vat"][value="' + (doc.vat || "separate") + '"]');
      if (vatInput) vatInput.checked = true;
      var items = (doc.items && doc.items.length) ? doc.items : [{}];
      items.forEach(addRow);
    } else {
      $("f-date").value = todayStr();
      $("f-quoteno").value = defaultQuoteNo();
      addRow({});
      addRow({});
      addRow({});
    }

    /* 공급자 정보: 같은 탭 세션 값 우선, 없으면 '기억하기' 저장분 */
    applySupplier((sess && sess.supplier) || savedSupplier);
  }

  function defaultQuoteNo() {
    var d = new Date();
    return "Q" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0") + "-01";
  }

  /* ---------- reset ---------- */
  $("btn-reset").addEventListener("click", function () {
    if (!confirm("입력한 내용을 모두 지울까요?\n(기억하기로 저장된 공급자 정보도 함께 삭제됩니다)")) return;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { localStorage.removeItem(SUPPLIER_KEY); } catch (e) {}
    location.reload();
  });

  /* ---------- print / pdf ---------- */
  $("btn-print").addEventListener("click", function () {
    window.print();
  });

  /* ---------- add row button ---------- */
  $("btn-add-row").addEventListener("click", function () {
    addRow({});
    update();
  });

  /* ---------- bind all form inputs ---------- */
  document.querySelectorAll(".form-panel input, .form-panel select, .form-panel textarea").forEach(function (el) {
    el.addEventListener("input", update);
    el.addEventListener("change", update);
  });

  /* ---------- preview scale-to-fit ---------- */
  function fitPreview() {
    var wrap = document.querySelector(".preview-wrap");
    var scaler = $("sheet-scaler");
    var sheet = document.querySelector(".sheet");
    if (!wrap || !scaler || !sheet) return;
    var scale = Math.min(1, wrap.clientWidth / sheet.offsetWidth);
    scaler.style.transform = "scale(" + scale + ")";
    scaler.style.width = sheet.offsetWidth + "px";
    wrap.style.height = sheet.offsetHeight * scale + "px";
  }
  window.addEventListener("resize", fitPreview);

  /* ---------- init ---------- */
  load();
  update();
  fitPreview();
  /* re-fit after fonts load */
  setTimeout(fitPreview, 300);
})();
