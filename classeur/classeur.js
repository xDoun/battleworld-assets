/* ===== Classeur Battleworld — moteur d'affichage =====
   À coller dans le JS "sur toutes les pages" de ForumActif (ou dans un
   bloc <script> de la page dédiée) UNIQUEMENT si la page contient bien
   un élément #classeur-app — sinon le script ne fait rien.

   ATTENTION : d'après les notes de la plateforme, le moteur de template
   ForumActif transforme les commentaires // en catastrophe s'ils passent
   par le bundle JS "sur toutes les pages" (tout finit sur une seule
   ligne). Ce fichier n'utilise QUE des commentaires /* */ pour cette
   raison — ne pas réintroduire de // en éditant.
*/

(function () {
  /* ---- À CONFIGURER : chemin vers ton dépôt GitHub + jsDelivr ---- */
  var REPO_BASE = "https://cdn.jsdelivr.net/gh/xDoun/battleworld-assets@main/classeur/";

  var CARDS_URL = REPO_BASE + "cards.json";
  var COLLECTIONS_URL = REPO_BASE + "collections.json";
  var IMAGES_BASE = REPO_BASE;

  var RARITY_ORDER = ["commune", "rare", "epique", "legendaire"];
  var RARITY_LABELS = {
    commune: "Communes",
    rare: "Rares",
    epique: "Épiques",
    legendaire: "Légendaires"
  };

  function qs(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function currentOwnUsername(root) {
    return root.getAttribute("data-username") || null;
  }

  function targetUsername(root) {
    var fromUrl = qs("pseudo");
    if (fromUrl) { return fromUrl; }
    return currentOwnUsername(root);
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) { throw new Error("fetch failed " + url); }
      return r.json();
    });
  }

  function buildSummary(cards, owned) {
    var totals = {};
    RARITY_ORDER.forEach(function (r) { totals[r] = { owned: 0, total: 0 }; });
    var ownedCount = 0;
    cards.forEach(function (c) {
      totals[c.rarity].total += 1;
      if (owned[c.id]) {
        totals[c.rarity].owned += 1;
        ownedCount += 1;
      }
    });
    return { totals: totals, ownedCount: ownedCount, total: cards.length };
  }

  function slotHtml(card, owned) {
    var qty = owned[card.id] || 0;
    if (qty > 0) {
      var dupe = qty > 1 ? '<span class="cx-dupe">×' + qty + '</span>' : "";
      return (
        '<div class="cx-slot owned" title="' + card.name + '">' +
          '<img src="' + IMAGES_BASE + card.image + '" alt="' + card.name + '" loading="lazy">' +
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
        '<input type="text" id="cx-pseudo-input" placeholder="Voir le classeur d\'un membre..." value="">' +
        '<button id="cx-pseudo-go">Voir</button>' +
        '<span class="cx-own-link" id="cx-own-link">Revenir à mon classeur</span>' +
      "</div>" +
      '<div class="cx-summary">' +
        '<div class="cx-total cx-count">' + summary.ownedCount + " / " + summary.total + " cartes</div>" +
        '<div class="cx-breakdown">' + breakdown + "</div>" +
      "</div>" +
      sectionsHtml;

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

    var ownLink = document.getElementById("cx-own-link");
    ownLink.addEventListener("click", function () {
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
      root.innerHTML = '<div class="cx-empty-state">Connecte-toi pour voir ton classeur, ou indique un pseudo via ?pseudo=NomDuMembre dans le lien.</div>';
      return;
    }

    Promise.all([fetchJson(CARDS_URL), fetchJson(COLLECTIONS_URL)])
      .then(function (results) {
        var cardsData = results[0].cards;
        var collectionsData = results[1];
        delete collectionsData._comment;
        render(root, cardsData, collectionsData, username);
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
