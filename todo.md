# [Todo Dash3 Web](readme.md)

## Description

Front End Dash3

## Page CV

- [x] Dans le formulaire Ajouter une section mettre le nom du type selectionné dans le champ titre de la section avec une possibilité de modification
- [x] la photo ne s'affiche pas
- [x] Possibilité de dupliquer un cv

## Formulaire d'ajout de client

- [x] Ajouter un input image

## Planning de la semaine

- [x] Fais moi une proposition pour la gestion de cette section (voir ci-dessous, à valider avant développement)

### Proposition

**Objectif** : sur le tableau de bord, voir d'un coup d'œil ce qui est prévu cette semaine, jour par jour, et planifier en glissant.

1. **Une seule source : les « interventions »** (table `plannings` ou le paquet Zap déjà installé côté Dash3) : date, heure début / fin, titre, type (visite, installation, maintenance, réunion, livraison), projet, client, intervenants (équipe), statut (prévu, en cours, fait, reporté), lieu (repris de la localisation du projet).
2. **Alimentée automatiquement** par ce qui existe déjà : tâches avec `start_date` / `expiration_date` dans la semaine, journaux datés de la semaine, dates de début / fin de projet, devis à relancer. Ces éléments s'affichent en lecture seule, avec un lien vers leur page.
3. **Affichage semaine** (lundi → dimanche) : une colonne par jour, cartes colorées par type, compteur par jour, bouton « + » sur chaque jour, navigation semaine précédente / suivante et « Aujourd'hui ». Sur mobile : liste par jour.
4. **Actions rapides** : glisser une carte d'un jour à l'autre (report), marquer « fait » (ouvre la création du journal pré-rempli), filtrer par technicien.
5. **API** : `GET /planning?from=…&to=…` (agrège interventions + tâches + journaux), `POST/PUT/DELETE /interventions`. Même API pour Dash3Mobile (vue « Ma journée » du technicien).
6. **Étapes** : (1) lecture seule tâches + journaux sur la semaine, (2) création / déplacement d'interventions, (3) affectation des techniciens et vue mobile.

## Page Icones

- [x] les dropdown choisir ne doit pas rester déroulé

## Page Projet

- [x] mettre les onglets devis taches et autres dans la carte resume du projet avec les quantités
- [x] mettre en place un système qui permet d'ajouter un gestionnaire de badge
  - [x] il faut un formulaire pour les informations du badge
  - [x] une solution pour intéger un modèle de badge spécifique au client

## Page Articles

- [x] Mettre des tags plus fins dans le filtre de recherches

## Page Article

- [x] Réduire l'espacement des li de la section lien et documents 
- [x] Enlever le bouton d'incrementation et de deécrémentation, 
  - [x] mettre le bouton de suppression sur la carte

## Page Fournisseurs

- [x] Ajouter des documents 
  - [x] catalogues
  - [x] flayer
  - [x] adresse map (web fait ; reste à intégrer à dash3Mobile : champs `address`, `latitude`, `longitude` de `GET /providers/{id}`)
  - [x] etc (fiche technique, contrat, photo, autre)
- [x] Ajouter des liens

## Page projet

- [x] Ajouter une localisation map (web fait ; reste à intégrer à dash3Mobile : `GET /projets/{id}` → `address`, `latitude`, `longitude`, `PUT /projets/{id}/location`)
- [x] Ajouter des documents 
  - [x] catalogues
  - [x] flayer
  - [x] adresse map (catégorie « Plan d'accès / adresse » ; dash3Mobile : champ `category` des documents)
  - [x] etc

## Journal Page

- [x] Utiliser le style de carte de joournal de dash3
- [x] Modifier l'interface du journal qu'il ressemble à celui du cv avec l'apercu et les cartes à coté à remplir
