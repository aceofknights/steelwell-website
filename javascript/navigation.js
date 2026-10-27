/* Native details keeps navigation usable without JavaScript. No storage access. */
document.querySelectorAll('.cw-navigation').forEach((navigation) => {
  const compact = window.matchMedia('(max-width: 1160px)');
  const summary = navigation.querySelector('summary');
  const syncNavigation = () => { navigation.open = !compact.matches; };
  syncNavigation();
  compact.addEventListener('change', syncNavigation);
  navigation.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && compact.matches && navigation.open) {
      navigation.open = false;
      summary.focus();
    }
  });
  navigation.addEventListener('click', (event) => {
    if (compact.matches && event.target.closest('a')) navigation.open = false;
  });
});
