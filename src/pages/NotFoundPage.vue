<template>
  <div class="page page-center">
    <div class="container-tight py-4">
      <div class="empty">
        <div class="empty-header">404</div>
        <p class="empty-title">Page introuvable</p>
        <p class="empty-subtitle text-secondary">La page demandée n'existe pas.</p>
        <div class="empty-action">
          <RouterLink :to="{ name: 'dashboard' }" class="btn btn-primary">
            <i class="ti ti-arrow-left me-1"></i>Retour au tableau de bord
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
