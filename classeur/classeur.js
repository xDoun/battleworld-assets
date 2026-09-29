/* ===== Classeur Battleworld — moteur d'affichage =====
   À coller dans une page ForumActif contenant <div id="classeur-app"></div>.
   Le script ne fait rien si cet élément est absent.

   ATTENTION : le moteur de template ForumActif écrase les commentaires //
   (tout le fichier finit sur une seule ligne dans le bundle JS "sur toutes
   les pages"). Ce fichier n'utilise QUE des commentaires block — ne pas
   réintroduire de // en éditant.
*/

(function () {
  var MAIN_BASE = "https://cdn.jsdelivr.net/gh/xDoun/battleworld-assets@main/classeur/";

  /* REPO_BASE suit la version depuis laquelle CE script a ete charge.
     Si la page pointe sur un SHA de commit (ex. @5e2f32b), la CSS, les
     vignettes et les images viennent du meme instantane : aucun cache a
     contourner, et tout reste coherent entre eux. */
  function detectBase() {
    try {
      var s = document.currentScript;
      if (!s) {
        var all = document.getElementsByTagName("script");
        for (var i = all.length - 1; i >= 0; i--) {
          if (all[i].src && all[i].src.indexOf("classeur.js") !== -1) { s = all[i]; break; }
        }
      }
      if (s && s.src) {
        var cut = s.src.indexOf("classeur.js");
        if (cut > 0) { return s.src.slice(0, cut); }
      }
    } catch (e) { e = null; }
    return MAIN_BASE;
  }

  var REPO_BASE = detectBase();

  var CARDS_URL = REPO_BASE + "cards.json";
  /* collections.json reste TOUJOURS sur @main : c'est le fichier que le
     staff modifie apres chaque tirage, il doit etre pris en compte tout de
     suite sans retoucher la page HTML du forum. */
  var COLLECTIONS_URL = MAIN_BASE + "collections.json";

  var RARITY_ORDER = ["commune", "rare", "epique", "legendaire"];
  var RARITY_LABELS = {
    commune: "Communes",
    rare: "Rares",
    epique: "Épiques",
    legendaire: "Légendaires"
  };

  /* charge classeur.css tout seul : inutile de toucher a style.css,
     et la feuille n'est chargee que sur la page du classeur */
  function ensureStyles() {
    if (document.getElementById("cx-styles")) { return; }
    var link = document.createElement("link");
    link.id = "cx-styles";
    link.rel = "stylesheet";
    link.href = REPO_BASE + "classeur.css";
    document.head.appendChild(link);
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  /* pseudo du membre connecte : ForumActif expose _userdata sur toutes
     ses pages. Le champ username peut etre enrobe de HTML quand le groupe
     a une couleur, d'ou le nettoyage via textContent. */
  function currentUser() {
    try {
      if (window._userdata && _userdata.session_logged_in && _userdata.username) {
        var tmp = document.createElement("div");
        tmp.innerHTML = _userdata.username;
        var name = (tmp.textContent || tmp.innerText || "").trim();
        if (name) { return name; }
      }
    } catch (e) { e = null; }
    return null;
  }

  function targetUsername(root) {
    return qs("pseudo") || currentUser() || root.getAttribute("data-username") || null;
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
    /* case verrouillee : on n'affiche QUE le numero, jamais le nom,
       pour ne pas devoiler la composition du set */
    return (
      '<div class="cx-slot locked">' +
        '<div class="cx-lock-icon">&#128274;</div>' +
        '<div class="cx-name">' + (card.number ? "n&deg;" + card.number : "?") + "</div>" +
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

    /* le lien retour n'a de sens que si on sait qui est connecte
       ET qu'on est en train de regarder le classeur de quelqu'un d'autre */
    var me = currentUser();
    var ownLinkHtml = (me && me !== username)
      ? '<span class="cx-own-link" id="cx-own-link">Revenir à mon classeur</span>'
      : "";

    var sectionsHtml = RARITY_ORDER.map(function (r) {
      /* tri par numero de carte : maintenant que les cases verrouillees
         affichent le numero, la suite doit se lire dans l'ordre */
      var group = cards.filter(function (c) { return c.rarity === r; })
                       .sort(function (a, b) { return (a.number || 999) - (b.number || 999); });
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
        ownLinkHtml +
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

    var ownLink = document.getElementById("cx-own-link");
    if (ownLink) {
      ownLink.addEventListener("click", function () {
        var url = new URL(window.location.href);
        url.searchParams.delete("pseudo");
        window.location.href = url.toString();
      });
    }
  }

  function init() {
    var root = document.getElementById("classeur-app");
    if (!root) { return; }

    ensureStyles();

    var username = targetUsername(root);
    if (!username) {
      root.innerHTML = '<div class="cx-empty-state">Connecte-toi pour voir ton classeur, ou ajoute ?pseudo=NomDuMembre à l\'adresse pour consulter celui d\'un autre membre.</div>';
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
