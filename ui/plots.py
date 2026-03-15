import logging
from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widgets import Label
from textual_plotext import PlotextPlot
import pandas as pd

logger = logging.getLogger("f1_tsa")

class TelemetryPlot(Vertical):
    """Widget custom che gestisce il grafico telemetrico e gli stati d'errore."""
    
    def __init__(self, title: str, color: str, y_label: str, **kwargs):
        super().__init__(**kwargs)
        self.plot_title = title
        self.plot_color = color
        self.y_label = y_label

    def compose(self) -> ComposeResult:
        yield PlotextPlot(id="plot_view")
        yield Label("DATA N/A", id="error_label", classes="hidden")

    def render_data(self, telemetry: pd.DataFrame, y_col: str) -> None:
        """Renderizza i dati sul grafico. Gestisce i dati mancanti."""
        plot = self.query_one("#plot_view", PlotextPlot)
        error_label = self.query_one("#error_label", Label)

        if telemetry is None or telemetry.empty or y_col not in telemetry.columns:
            plot.display = False
            error_label.display = True
            logger.warning(f"Dati mancanti per {self.plot_title}")
            return

        plot.display = True
        error_label.display = False
        
        plot.plt.clear_data()
        plot.plt.plot(telemetry['Distance'], telemetry[y_col], color=self.plot_color)
        plot.plt.title(self.plot_title)
        plot.plt.xlabel("Distance (m)")
        plot.plt.ylabel(self.y_label)
        plot.refresh()