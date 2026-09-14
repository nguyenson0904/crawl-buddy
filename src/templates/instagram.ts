export const INSTAGRAM_NOTE_TEMPLATE = `---
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

{% if thumbnailUrl %}
{{ thumbnailUrl | image:title }}

{% endif %}
{% if caption %}
{{ caption }}

{% endif %}
{% if metrics %}
## Metrics

{{ metrics | table }}
{% endif %}
{% if url %}
{{ url | link:"Open post" }}
{% endif %}
`;
