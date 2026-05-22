FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    iptables \
    ipset \
    iproute2 \
    dnsutils \
    aggregate \
    build-essential \
    libsqlite3-dev \
    sqlite3 \
    jq \
    ripgrep \
    fd-find \
    bat \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s $(which fdfind) /usr/local/bin/fd

RUN git config --system --add safe.directory /workspace

COPY install-ai-tools.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/install-ai-tools.sh

COPY init-firewall.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "vscode ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/vscode-firewall && \
  chmod 0440 /etc/sudoers.d/vscode-firewall

COPY bashrc.sh /usr/local/bin/devcontainer-bashrc.sh
RUN echo "source /usr/local/bin/devcontainer-bashrc.sh" >> /home/vscode/.bashrc

USER vscode
# Bun runtime
RUN curl -fsSL https://bun.sh/install | bash
