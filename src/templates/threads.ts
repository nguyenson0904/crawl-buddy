export const THREADS_NOTE_TEMPLATE = `---
{{ platform | yaml_property:"platform" }}
{% if id %}{{ id | yaml_property:"id" }}{% endif %}
{% if shortcode %}{{ shortcode | yaml_property:"shortcode" }}{% endif %}
{{ url | yaml_property:"url" }}
{{ status | yaml_property:"status" }}
{% if authorHandle %}{{ authorHandle | yaml_property:"author" }}{% endif %}
{% if authorName %}{{ authorName | yaml_property:"author_name" }}{% endif %}
{% if authorUrl %}{{ authorUrl | yaml_property:"author_url" }}{% endif %}
{% if postedAt %}{{ postedAt | yaml_property:"posted" }}{% endif %}
{% if scrapedAt %}{{ scrapedAt | yaml_property:"scraped" }}{% endif %}
---

# {{ title }}

{% if caption %}
{{ caption }}

{% endif %}
{% if media %}
## Media

{% for item in media %}
{{ item.url | image:"Media" }}
{% endfor %}

{% endif %}
{% if metrics %}
## Metrics

{{ metrics | table }}
{% endif %}
{% if threadReplies %}
## Thread Replies

{% for reply in threadReplies %}
> **@{{ reply.author.handle }}**{% if reply.postedAt %} ({{ reply.postedAt }}){% endif %}:
> {{ reply.text }}
{% if reply.likes %}> *❤️ {{ reply.likes }}*{% endif %}

{% endfor %}
{% endif %}
{% if url %}
{{ url | link:"Open post" }}
{% endif %}
`;
