<script lang="ts">
</script>

<div class="sla-landing flex flex-col items-center justify-center text-center p-6 gap-3 h-full text-sla-fg">
	<h2 class="sla-landing__title text-2xl font-semibold">SLA Scorecard</h2>
	<p class="sla-landing__subtitle text-sm text-slate-500">Map data to populate the scorecard.</p>
	<ul class="sla-landing__list list-none p-0 m-0 flex flex-col gap-1.5 text-left">
		<li>SLA — name of each SLA (e.g. 'Payment API Uptime')</li>
		<li>Category — for the filter pills (e.g. 'Platform', 'Support')</li>
		<li>Owner — owner name and initials (e.g. 'Payments', 'PA')</li>
		<li>Current, Target — measures for the bullet chart</li>
		<li>Time to breach — days until breach (optional)</li>
		<li>30D trend — comma-separated 30 numeric values (optional)</li>
	</ul>
</div>
