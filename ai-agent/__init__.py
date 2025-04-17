# Make sure this module can be imported under different names
# This enables importing as both regular path and with hyphens

# Import agent.py (this is the main agent definition)
from . import agent

# Specifically export the root_agent
from .agent import root_agent 