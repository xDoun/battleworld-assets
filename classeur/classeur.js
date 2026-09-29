/* ===== Classeur Battleworld — moteur d'affichage =====
   À coller dans une page ForumActif contenant <div id="classeur-app"></div>.
   Le script ne fait rien si cet élément est absent.

   ATTENTION : le moteur de template ForumActif écrase les commentaires //
   (tout le fichier finit sur une seule ligne dans le bundle JS "sur toutes
   les pages"). Ce fichier n'utilise QUE des commentaires block — ne pas
   réintroduire de // en éditant.
*/

(function () {
  var REPO_BASE = "https://cdn.jsdelivr.net/gh/xDoun/battleworld-assets@main/classeur/";

  var CARDS_URL = REPO_BASE + "cards.json";
  var COLLECTIONS_URL = REPO_BASE + "collections.json";

  var RARITY_ORDER = ["commune", "rare", "epique", "legendaire"];
  var RARITY_LABELS = {
    commune: "Communes",
    rare: "Rares",
    epique: "Épiques",
    legendaire: "Légendaires"
  };

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function targetUsername(root) {
    return qs("pseudo") || root.getAttribute("data-username") || null;
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) { throw new Error("fetch failed " + url); }
      return r.json();
    });
  }

  function thumbUrl(card) {
    return REPO_BASE + "thumbs/" + card.id + ".png";
  }

  function fullUrl(card) {
    return REPO_BASE + card.image;
  }

  function buildSummary(cards, owned) {
    var totals = {};
    RARITY_ORDER.forEach(function (r) { totals[r] = { owned: 0, total: 0 }; });
    var ownedCount = 0;
    cards.forEach(function (c) {
      totals[c.rarity].total += 1;
      if (owned[c.id]) { totals[c.rarity].owned += 1; ownedCount += 1; }
    });
    return { totals: totals, ownedCount: ownedCount, total: cards.length };
  }

  function slotHtml(card, owned) {
    var qty = owned[card.id] || 0;
    if (qty > 0) {
      var dupe = qty > 1 ? '<span class="cx-dupe">×' + qty + "</span>" : "";
      /* la vignette est statique et légère ; si elle manque encore sur le
         dépôt, on retombe automatiquement sur l'image complète */
      return (
        '<div class="cx-slot owned" data-card="' + card.id + '" title="' + card.name + ' — clic pour agrandir">' +
          '<img src="' + thumbUrl(card) + '" alt="' + card.name + '" loading="lazy"' +
               " onerror=\"this.onerror=null;this.src='" + fullUrl(card) + "';\">" +
          dupe +
        "</div>"
      );
    }
    return (
      '<div class="cx-slot locked">' +
        '<div class="cx-lock-icon">&#128274;</div>' +
        '<div class="cx-name">' + card.name + "</div>" +
      "</div>"
    );
  }

  function openModal(card) {
    var overlay = document.createElement("div");
    overlay.className = "cx-modal";
    overlay.innerHTML =
      '<div class="cx-modal-inner">' +
        '<img src="' + fullUrl(card) + '" alt="' + card.name + '">' +
        '<div class="cx-modal-caption">' + card.name +
          (card.number ? " &nbsp;·&nbsp; n°" + card.number : "") +
        "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    function close() {
      if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") { close(); }
    }
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
  }

  function render(root, cards, collections, username) {
    var owned = (collections[username] && collections[username].cards) || {};
    var summary = buildSummary(cards, owned);

    var breakdown = RARITY_ORDER.map(function (r) {
      return RARITY_LABELS[r] + " " + summary.totals[r].owned + "/" + summary.totals[r].total;
    }).join(" &nbsp;·&nbsp; ");

    var sectionsHtml = RARITY_ORDER.map(function (r) {
      var group = cards.filter(function (c) { return c.rarity === r; });
      var tiles = group.map(function (c) { return slotHtml(c, owned); }).join("");
      return (
        '<div class="cx-section-title">' + RARITY_LABELS[r] + "</div>" +
        '<div class="cx-grid">' + tiles + "</div>"
      );
    }).join("");

    root.innerHTML =
      "<h1>Classeur de " + username + "</h1>" +
      '<div class="cx-subtitle">Collection de cartes — Battleworld, Set 1</div>' +
      '<div class="cx-switcher">' +
        '<input type="text" id="cx-pseudo-input" placeholder="Voir le classeur d\'un membre...">' +
        '<button id="cx-pseudo-go">Voir</button>' +
        '<span class="cx-own-link" id="cx-own-link">Revenir à mon classeur</span>' +
      "</div>" +
      '<div class="cx-summary">' +
        '<div class="cx-total cx-count">' + summary.ownedCount + " / " + summary.total + " cartes</div>" +
        '<div class="cx-breakdown">' + breakdown + "</div>" +
      "</div>" +
      sectionsHtml;

    var byId = {};
    cards.forEach(function (c) { byId[c.id] = c; });

    root.addEventListener("click", function (e) {
      var slot = e.target.closest ? e.target.closest(".cx-slot.owned") : null;
      if (slot) { openModal(byId[slot.getAttribute("data-card")]); }
    });

    var goBtn = document.getElementById("cx-pseudo-go");
    var input = document.getElementById("cx-pseudo-input");
    goBtn.addEventListener("click", function () {
      var val = input.value.trim();
      if (!val) { return; }
      var url = new URL(window.location.href);
      url.searchParams.set("pseudo", val);
      window.location.href = url.toString();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { goBtn.click(); }
    });

    document.getElementById("cx-own-link").addEventListener("click", function () {
      var url = new URL(window.location.href);
      url.searchParams.delete("pseudo");
      window.location.href = url.toString();
    });
  }

  function init() {
    var root = document.getElementById("classeur-app");
    if (!root) { return; }

    var username = targetUsername(root);
    if (!username) {
      root.innerHTML = '<div class="cx-empty-state">Indique un pseudo via ?pseudo=NomDuMembre dans le lien pour afficher un classeur.</div>';
      return;
    }

    Promise.all([fetchJson(CARDS_URL), fetchJson(COLLECTIONS_URL)])
      .then(function (results) {
        var collectionsData = results[1];
        delete collectionsData._comment;
        render(root, results[0].cards, collectionsData, username);
      })
      .catch(function (err) {
        root.innerHTML = '<div class="cx-empty-state">Le classeur n\'a pas pu être chargé pour le moment. Réessaie un peu plus tard.</div>';
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
